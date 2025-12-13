# APGMS Assessor 10of10 (v3)

This folder is a self-contained readiness assessor designed to run inside the APGMS repo without overwriting existing folders.

It produces:
- assessment/reports/apgms-assess.v3.json
- assessment/reports/apgms-assess.v3.md
- assessment/reports/apgms-assess.process.v3.md

## Quick run (WSL or Linux)

From the repo root:

1) Create the reports directory (optional):
   mkdir -p assessment/reports

2) Run the fast suite (typecheck + unit tests + static checks):
   node assessment/assessor-10of10-v3/scripts/apgms-assess.cjs --fast --outdir assessment/reports

3) Run the full suite (includes readiness scripts if available):
   node assessment/assessor-10of10-v3/scripts/apgms-assess.cjs --all --outdir assessment/reports

4) Run the production suite (adds supply-chain scans):
   node assessment/assessor-10of10-v3/scripts/apgms-assess.cjs --production --outdir assessment/reports

Add --no-fail to avoid a non-zero exit code when gates are failing:
   node ... --fast --no-fail

## Applying repo additions (optional)

Some checks expect files that should live in the repo root (e.g. .github/workflows/assess.yml, infra/iac/README.md).
This pack includes safe, non-overwriting templates in:

  assessment/assessor-10of10-v3/repo-additions/

Copy them into the repo root if desired.
