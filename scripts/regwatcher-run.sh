#!/usr/bin/env bash
set -euo pipefail
# Resolve a tracked regwatcher bin and execute with Node
found="$(git ls-files | grep -E '/regwatcher/.*/bin/run\.mjs$' | head -n1 || true)"
if [ -z "${found:-}" ]; then
  echo "regwatcher bin not found in tracked files (expected .../regwatcher/.../bin/run.mjs)" >&2
  exit 2
fi
exec node "$found" "$@"
