# Assessor 10of10 (v3) - Drop-in Pack

This is an improved assessor pack intended to be copied into your APGMS repo at:

  assessment/assessor-10of10-v3/

## What improved vs v2 (high level)

- Stage-aware checks: prototype vs production, with separate gating rules.
- Pillar + process model: every requirement maps to a pillar and one or more business processes.
- Live checks are suites: fast / all / production.
- Cleaner outputs:
  - apgms-assess.v3.json (full detail)
  - apgms-assess.v3.md (exec summary)
  - apgms-assess.process.v3.md (pillar x process breakdown)
- Optional repo-additions pack (workflow + IaC README) with safe copy script.

## Run commands (from repo root)

Fast (recommended most of the time):
  node assessment/assessor-10of10-v3/scripts/apgms-assess.cjs --fast --outdir assessment/reports

Full:
  node assessment/assessor-10of10-v3/scripts/apgms-assess.cjs --all --outdir assessment/reports

Production:
  node assessment/assessor-10of10-v3/scripts/apgms-assess.cjs --production --outdir assessment/reports

## Optional: apply repo additions

  node assessment/assessor-10of10-v3/scripts/assessor/apply-repo-additions.cjs

This will copy:
- .github/workflows/assess.yml
- infra/iac/README.md
into the repo root (without overwriting existing files).
