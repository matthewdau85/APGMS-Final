#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------
# export-apgms-code.sh
# Dump all code/text files in the repo into one text file
# Excludes:
#  - node_modules
#  - .git
#  - dist
#  - output file itself
# ------------------------------------------------------------

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUTPUT="$ROOT/combined-code-export.txt"

echo "Repo root detected as: $ROOT"
echo "Output file will be:   $OUTPUT"
echo ""

# File extensions considered code/text
EXTENSIONS=(
  ts tsx
  js jsx
  mjs cjs
  json
  prisma
  sql
  yml yaml
  md
  ps1
  html css
)

# Build find expression for extensions
EXT_EXPR=()
for ext in "${EXTENSIONS[@]}"; do
  EXT_EXPR+=(-name "*.$ext" -o)
done
unset 'EXT_EXPR[-1]' # remove trailing -o

# Collect files
mapfile -t FILES < <(
  find "$ROOT" -type f \
    \( "${EXT_EXPR[@]}" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/.git/*" \
    ! -path "*/dist/*" \
    ! -path "$OUTPUT" \
    | sort
)

# Write header
{
  echo "Code export generated on $(date '+%Y-%m-%d %H:%M:%S')"
  echo
} > "$OUTPUT"

# Dump contents
for file in "${FILES[@]}"; do
  {
    echo "============================================================"
    echo "FILE: $file"
    echo "============================================================"
    cat "$file"
    echo
    echo
  } >> "$OUTPUT"
done

echo
echo "Exported ${#FILES[@]} files to:"
echo "  $OUTPUT"
