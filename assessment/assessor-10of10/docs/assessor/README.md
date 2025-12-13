# APGMS Assessor (10/10 framework)

This is a regulator-grade assessment framework that evaluates APGMS across two readiness stages:

- Prototype: credibility + deterministic demo + core workflow coverage
- Production: security, tenancy controls, resilience, IR/DR, evidence traceability, and gated releases

Core artifacts:
- docs/assessor/requirements.v2.json : control catalogue (source of truth)
- scripts/apgms-assess.cjs           : entrypoint
- scripts/assessor/apgms-assessor.cjs: engine
- scripts/assessor/e2e-runner.cjs    : contract runner (HTTP-based)
- scripts/assessor/restore-drill.cjs : backup/restore drill scaffolding

Quickstart:
1) Patch package.json scripts:
   node scripts/assessor/patch-package-json.cjs

2) Run:
   pnpm assess:fast
   pnpm assess:all
   pnpm assess:production

Outputs:
- reports/apgms-assess.v2.json
- reports/apgms-assess.v2.md

Notes:
- For production, any SKIP counts as FAIL by default (see requirements.v2.json).
- Add more requirements by extending the JSON. Add new check types in scripts/assessor/checks.cjs.
