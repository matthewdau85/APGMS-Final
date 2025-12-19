#!/usr/bin/env sh
set -eu

fail=0

# Exclude the guard script itself + generated logs
EX1=":(exclude)scripts/check-prisma-schema-paths.sh"
EX2=":(exclude)scripts/logs"

check_grep() {
  pattern="$1"
  message="$2"

  if git grep -n -- "$pattern" -- . "$EX1" "$EX2" >/dev/null 2>&1; then
    echo "ERROR: $message"
    git grep -n -- "$pattern" -- . "$EX1" "$EX2" || true
    fail=1
  fi
}

# Hard fail on old paths
check_grep "shared/prisma/schema.prisma" "Found references to shared/prisma/schema.prisma (must be infra/prisma/schema.prisma)"
check_grep "shared/Prisma/schema.prisma" "Found references to shared/Prisma/schema.prisma (case/path mismatch; must be infra/prisma/schema.prisma)"

# Fail on stale schema-relative form
if git grep -n -E -- "--schema(=|[[:space:]]+)prisma/schema\.prisma" -- . "$EX1" "$EX2" >/dev/null 2>&1; then
  echo "ERROR: Found '--schema prisma/schema.prisma' usage (must use workspace scripts or infra/prisma/schema.prisma)"
  git grep -n -E -- "--schema(=|[[:space:]]+)prisma/schema\.prisma" -- . "$EX1" "$EX2" || true
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  exit 1
fi

echo "OK: Prisma schema path references are canonical."
