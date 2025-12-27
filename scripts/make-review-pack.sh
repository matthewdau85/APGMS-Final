#!/usr/bin/env bash
set -u
set -o pipefail

# Resolve repo root
if git rev-parse --show-toplevel >/dev/null 2>&1; then
  ROOT="$(git rev-parse --show-toplevel)"
else
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

TS="$(date +%Y%m%d_%H%M%S)"
OUT="${ROOT}/_review_pack_${TS}"

echo "[make-review-pack] ROOT=${ROOT}"
echo "[make-review-pack] OUT=${OUT}"

mkdir -p "${OUT}/context" "${OUT}/evidence" "${OUT}/review" "${OUT}/repo"

run() {
  local name="$1"; shift
  local file="${OUT}/evidence/${name}.txt"

  {
    echo "CMD: $*"
    echo "PWD: ${ROOT}"
    echo "UTC: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "----"
    "$@"
    rc=$?
    echo "----"
    echo "EXIT_CODE: ${rc}"
    # IMPORTANT: do not exit; just return success so the pack continues
    return 0
  } >"${file}" 2>&1 || true
}

# Context
{
  echo "REPO_ROOT: ${ROOT}"
  echo "GIT_SHA: $(git -C "${ROOT}" rev-parse HEAD 2>/dev/null || echo "NO_GIT")"
  echo "GIT_BRANCH: $(git -C "${ROOT}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "NO_GIT")"
  echo "GIT_STATUS:"
  git -C "${ROOT}" status --porcelain=v1 2>/dev/null || true
} >"${OUT}/context/repo_identity.txt"

{
  echo "uname -a:"
  uname -a || true
  echo
  echo "node -v:"
  node -v || true
  echo
  echo "pnpm -v:"
  pnpm -v || true
  echo
  echo "docker version:"
  docker version || true
} >"${OUT}/context/environment.txt"

# Evidence (capture output even if commands fail)
run "01_build" bash -lc "cd '${ROOT}' && pnpm -r build"
run "02_typecheck" bash -lc "cd '${ROOT}' && pnpm -r typecheck"
run "03_lint" bash -lc "cd '${ROOT}' && pnpm -r lint"
run "04_tests" bash -lc "cd '${ROOT}' && pnpm -r test"
run "05_docker_compose_config" bash -lc "cd '${ROOT}' && docker compose config"
run "06_db_migrations" bash -lc "cd '${ROOT}' && pnpm -w exec prisma migrate status --schema infra/prisma/schema.prisma"
run "07_pnpm_audit" bash -lc "cd '${ROOT}' && pnpm audit || true"
run "08_git_diff" bash -lc "cd '${ROOT}' && git diff"
run "09_git_diff_staged" bash -lc "cd '${ROOT}' && git diff --staged"
run "10_repo_tree" bash -lc "cd '${ROOT}' && (command -v tree >/dev/null 2>&1 && tree -L 4 || find . -maxdepth 4 -type f | sort)"

# Review docs
cat > "${OUT}/review/INDEX.md" <<'MD'
# Review Pack Index (Common Readiness Model)

Use evidence/*.txt and repo/ snapshot. Do not guess.
If evidence is missing for a pillar, mark "Insufficient evidence" and list what to capture next run.
MD

for f in README_FOR_REVIEW.md ARCHITECTURE.md WORKFLOWS.md DATA_GOVERNANCE.md RELIABILITY.md OBSERVABILITY.md PERFORMANCE.md RUNBOOK.md COMPLIANCE.md; do
  if [ ! -f "${OUT}/review/${f}" ]; then
    printf "# %s\n\n(TODO: fill this)\n" "${f%.md}" > "${OUT}/review/${f}"
  fi
done

# Repo snapshot (tracked files only)
if git -C "${ROOT}" rev-parse HEAD >/dev/null 2>&1; then
  echo "[make-review-pack] Creating repo snapshot via git archive..."
  (cd "${ROOT}" && git archive --format=tar HEAD) | tar -xf - -C "${OUT}/repo" || true
fi

# Fallback if repo snapshot is empty (rare)
if [ "$(find "${OUT}/repo" -type f 2>/dev/null | wc -l)" -eq 0 ]; then
  echo "[make-review-pack] Repo snapshot empty; using fallback copy (excluding heavy dirs)..."
  rsync -a \
    --exclude ".git" \
    --exclude "node_modules" \
    --exclude "dist" \
    --exclude "build" \
    --exclude "coverage" \
    --exclude "*.log" \
    --exclude ".env" \
    --exclude ".env.*" \
    "${ROOT}/" "${OUT}/repo/" || true
fi

# Checksums
( cd "${OUT}" && find . -type f -print0 | sort -z | xargs -0 sha256sum ) > "${OUT}/manifest.sha256"

# Flat bundle for zip-hostile tools
{
  echo "=== CONTEXT ==="
  echo "--- context/repo_identity.txt ---"
  cat "${OUT}/context/repo_identity.txt"
  echo
  echo "--- context/environment.txt ---"
  cat "${OUT}/context/environment.txt"
  echo
  echo "=== REVIEW DOCS ==="
  for p in "${OUT}/review/"*.md; do
    echo "--- review/$(basename "$p") ---"
    cat "$p"
    echo
  done
  echo "=== EVIDENCE FILES ==="
  for p in "${OUT}/evidence/"*.txt; do
    echo "--- evidence/$(basename "$p") ---"
    cat "$p"
    echo
  done
} > "${OUT}/review_pack_flat.txt"

echo "[make-review-pack] Created: ${OUT}"
