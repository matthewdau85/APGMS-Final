#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "This script must be run from within a git repository" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is dirty; commit or stash changes before updating branches" >&2
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
trap 'git switch --quiet "${current_branch}" >/dev/null 2>&1 || true' EXIT

git fetch --all --prune

while IFS= read -r branch; do
  if [[ -z "${branch}" ]]; then
    continue
  fi

  if [[ "${branch}" != "${current_branch}" ]]; then
    git switch --quiet "${branch}"
  fi

  echo "Updating ${branch}"
  git pull --ff-only --quiet || {
    echo "Failed to fast-forward ${branch}; resolve manually" >&2
    exit 1
  }
done < <(git for-each-ref --format='%(refname:short)' refs/heads/)

git switch --quiet "${current_branch}"
trap - EXIT
echo "All local branches are up to date"
