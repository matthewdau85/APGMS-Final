#!/usr/bin/env bash
# verify-gh-main.sh
# WSL-safe verification script:
# - Checks repo + remote
# - Checks uncommitted changes
# - Fetches origin
# - Reports ahead/behind for current branch
# - Verifies whether HEAD is contained in origin/main
# - Shows which remote branches contain HEAD
# - Optionally updates local main (fast-forward only)
#
# Usage:
#   chmod +x ./verify-gh-main.sh
#   ./verify-gh-main.sh
#   ./verify-gh-main.sh --update-main
#
# Exit codes:
#   0 = OK: clean + pushed + HEAD is in origin/main
#   1 = Not a git repo / missing origin/main / missing origin
#   2 = Working tree not clean
#   3 = Current branch has commits not pushed to origin
#   4 = HEAD not contained in origin/main (needs merge or you are on different branch)
#   5 = main update requested but fast-forward failed

set -euo pipefail

UPDATE_MAIN=0
if [[ "${1:-}" == "--update-main" ]]; then
  UPDATE_MAIN=1
fi

red()   { printf "\033[31m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow(){ printf "\033[33m%s\033[0m\n" "$*"; }
blue()  { printf "\033[34m%s\033[0m\n" "$*"; }

die() { red "ERROR: $*"; exit "${2:-1}"; }

hr() { printf "\n%s\n" "------------------------------------------------------------"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

require_cmd git

hr
blue "APGMS GitHub main verification (WSL)"
date

# Ensure we are inside a git repo
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  die "Not inside a git repository. cd to your repo root and re-run." 1
fi

TOP="$(git rev-parse --show-toplevel)"
hr
blue "Repo"
echo "Top-level: $TOP"

# Check remotes
hr
blue "Remote"
if ! git remote get-url origin >/dev/null 2>&1; then
  die "Remote 'origin' not found. Add origin or run in the correct repo." 1
fi
echo "origin: $(git remote get-url origin)"
git remote -v | sed 's/^/  /'

# Check current branch
hr
blue "Branch"
BRANCH="$(git branch --show-current || true)"
if [[ -z "$BRANCH" ]]; then
  # Detached HEAD
  yellow "You are in detached HEAD state."
  BRANCH="(detached)"
else
  echo "Current branch: $BRANCH"
fi

# Check working tree cleanliness
hr
blue "Working tree"
if ! git diff --quiet || ! git diff --cached --quiet; then
  red "Working tree is NOT clean."
  echo
  yellow "Unstaged changes:"
  git diff --name-only | sed 's/^/  /' || true
  echo
  yellow "Staged changes:"
  git diff --cached --name-only | sed 's/^/  /' || true
  echo
  yellow "Run: git status"
  exit 2
else
  green "Working tree clean."
fi

# Fetch origin
hr
blue "Fetch"
git fetch origin --prune
green "Fetched origin."

# Verify origin/main exists
hr
blue "origin/main"
if ! git rev-parse --verify origin/main >/dev/null 2>&1; then
  die "origin/main not found. Does your default branch use a different name?" 1
fi
echo "origin/main: $(git rev-parse --short origin/main)"

# Ahead/behind for current branch (if not detached)
if [[ "$BRANCH" != "(detached)" ]]; then
  hr
  blue "Ahead/Behind vs origin/$BRANCH"
  if git rev-parse --verify "origin/$BRANCH" >/dev/null 2>&1; then
    # counts: "<ahead> <behind>"
    read -r AHEAD BEHIND < <(git rev-list --left-right --count "origin/$BRANCH...HEAD")
    echo "Ahead (local commits not on origin): $AHEAD"
    echo "Behind (origin commits not local):   $BEHIND"

    if [[ "$AHEAD" -gt 0 ]]; then
      red "Your branch has $AHEAD commit(s) not pushed to origin."
      echo
      yellow "Commits not pushed:"
      git log --oneline --decorate "origin/$BRANCH..HEAD" | sed 's/^/  /'
      echo
      yellow "Fix: git push"
      exit 3
    else
      green "No unpushed commits on current branch."
    fi

    if [[ "$BEHIND" -gt 0 ]]; then
      yellow "Note: Your local branch is behind origin by $BEHIND commit(s)."
      echo "You may want: git pull --ff-only"
    fi
  else
    yellow "origin/$BRANCH does not exist (branch not pushed yet)."
    echo "Fix: git push -u origin \"$BRANCH\""
    exit 3
  fi
else
  hr
  yellow "Detached HEAD: skipping ahead/behind check for a branch."
fi

# Check whether HEAD is contained in origin/main
hr
blue "Is HEAD in origin/main?"
if git merge-base --is-ancestor HEAD origin/main; then
  green "YES: HEAD is contained in origin/main."
else
  red "NO: HEAD is NOT contained in origin/main."
  echo
  yellow "Remote branches containing HEAD:"
  git branch -r --contains HEAD | sed 's/^/  /' || true
  echo
  yellow "This usually means:"
  echo "  - you are on a feature branch that has not been merged to main, OR"
  echo "  - you are on detached HEAD, OR"
  echo "  - main is not the default branch / uses a different name."
  exit 4
fi

# Optional: update local main fast-forward only
if [[ "$UPDATE_MAIN" -eq 1 ]]; then
  hr
  blue "Update local main (fast-forward only)"
  CURRENT_REF="$(git rev-parse --abbrev-ref HEAD)"
  # Checkout main and FF only
  git checkout main >/dev/null 2>&1 || die "Local branch 'main' not found." 5
  if ! git pull --ff-only origin main; then
    die "Fast-forward pull failed. Resolve manually (likely divergence)." 5
  fi
  green "Local main updated."
  # Return to original ref if possible
  if [[ "$CURRENT_REF" != "main" ]]; then
    git checkout "$CURRENT_REF" >/dev/null 2>&1 || true
  fi
fi

hr
green "All checks passed: clean + pushed + HEAD is on origin/main."
exit 0
