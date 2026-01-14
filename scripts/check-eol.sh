#!/usr/bin/env bash
set -euo pipefail

readonly TARGET_DIRS=(
  "scripts"
  "scripts/readiness"
  "services/api-gateway/scripts"
  "assessment/assessor-10of10/scripts"
  "assessment/assessor-10of10-v3/scripts"
)
readonly EXTENSIONS=(
  ".sh"
  ".bash"
  ".cjs"
  ".mjs"
)

exit_code=0

for dir in "${TARGET_DIRS[@]}"; do
  for ext in "${EXTENSIONS[@]}"; do
    while IFS= read -r file; do
      [ -z "${file}" ] && continue
      if LC_ALL=C grep -q $'\\r' "${file}"; then
        echo "CRLF detected in ${file}"
        exit_code=1
      fi
    done < <(git ls-files "${dir}/**/*${ext}")
  done
done

if [ "${exit_code}" -ne 0 ]; then
  echo
  echo "Run 'dos2unix <file>' or 'sed -i \"s/\\r$//\" <file>' to normalize line endings."
  exit 1
fi
