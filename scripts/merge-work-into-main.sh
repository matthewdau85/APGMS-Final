#!/usr/bin/env bash
set -euo pipefail

echo "=== APGMS: Merge work -> main (Codespaces-safe) ==="

# --- config ---
WORK_BRANCH="work"
MAIN_BRANCH="main"
REMOTE="origin"

# --- helpers ---
fail() {
  echo "ERROR: $1"
  exit 1
}

info() {
  echo "▶ $1"
}

# --- sanity checks ---
info "Checking git availability"
command -v git >/dev/null 2>&1 || fail "git not found"

info "Fetching latest refs"
git fetch "$REMOTE" --prune

info "Checking working tree cleanliness"
if [[ -n "$(git status --porcelain)" ]]; then
  git status
  fail "Working tree is not clean. Commit or stash changes first."
fi

info "Checking that work branch exists"
git show-ref --verify --quiet "refs/heads/$WORK_BRANCH" || \
  fail "Local branch '$WORK_BRANCH' does not exist"

info "Checking that main branch exists"
git show-ref --verify --quiet "refs/heads/$MAIN_BRANCH" || \
  fail "Local branch '$MAIN_BRANCH' does not exist"

# --- ensure work is up to date ---
info "Switching to $WORK_BRANCH"
git checkout "$WORK_BRANCH"

info "Pulling latest $WORK_BRANCH"
git pull "$REMOTE" "$WORK_BRANCH"

# --- switch to main ---
info "Switching to $MAIN_BRANCH"
git checkout "$MAIN_BRANCH"

info "Pulling latest $MAIN_BRANCH"
git pull "$REMOTE" "$MAIN_BRANCH"

# --- merge ---
info "Merging $WORK_BRANCH into $MAIN_BRANCH"
if ! git merge "$WORK_BRANCH"; then
  echo
  echo "Merge conflicts detected."
  echo "Resolve conflicts, then run:"
  echo "  git add <resolved-files>"
  echo "  git commit"
  exit 1
fi

# --- post-merge verification ---
info "Verifying no commits remain only on $WORK_BRANCH"
if [[ -n "$(git log "$MAIN_BRANCH..$WORK_BRANCH" --oneline)" ]]; then
  git log "$MAIN_BRANCH..$WORK_BRANCH" --oneline
  fail "Some commits still exist only on $WORK_BRANCH"
fi

# --- push ---
info "Pushing $MAIN_BRANCH to $REMOTE"
git push "$REMOTE" "$MAIN_BRANCH"

# --- final confirmation ---
info "Merge complete"
git log --oneline --decorate -5

echo
echo "SUCCESS: '$WORK_BRANCH' is fully merged into '$MAIN_BRANCH' and pushed."
