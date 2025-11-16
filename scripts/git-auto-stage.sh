#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "This script must be run inside a git repository" >&2
  exit 1
fi

mapfile -t files < <(git status --porcelain --untracked-files=all | awk '{print $2}' | sed '/^$/d')

if [ ${#files[@]} -eq 0 ]; then
  echo "No unstaged files detected; nothing to commit."
  exit 0
fi

for file in "${files[@]}"; do
  if [ ! -e "$file" ] && [ ! -L "$file" ]; then
    # File may have been deleted; stage the deletion explicitly
    git add "$file" 2>/dev/null || git rm --cached "$file" >/dev/null 2>&1 || true
  else
    git add "$file"
  fi

  safe_name=$(echo "$file" | tr ' /' '__')
  message="chore: update ${safe_name}"
  git commit -m "$message"

  if git remote get-url origin >/dev/null 2>&1; then
    # Push to main if it exists, otherwise push to the current branch
    if git show-ref --verify --quiet refs/heads/main; then
      git push origin main
    else
      current_branch=$(git rev-parse --abbrev-ref HEAD)
      git push origin "$current_branch"
    fi
  else
    echo "No 'origin' remote configured; skipping push for ${file}."
  fi

done

if git remote get-url origin >/dev/null 2>&1; then
  # Update all local branches on origin as requested
  while read -r branch; do
    branch=${branch#* }
    branch=$(echo "$branch" | xargs)
    [ -n "$branch" ] || continue
    git push origin "$branch" || true
  done < <(git for-each-ref --format='%(refname:short)' refs/heads/)
else
  echo "Remote 'origin' missing; unable to update branches."
fi
