# Changelog

## v3 (2025-12-13)

- Introduced requirements.v3.json with:
  - explicit pillars
  - explicit processes
  - stage-aware checks (prototype vs production)
- Added suite-aware live commands:
  - --fast (typecheck + api gateway tests)
  - --all (adds readiness suite)
  - --production (adds scans)
- Added generated outputs:
  - apgms-assess.v3.md (executive)
  - apgms-assess.process.v3.md (process breakdown + matrix)
- Added repo-additions templates and apply script.
- Added missing previously referenced artifacts:
  - demo-seed.cjs
  - e2e-runner.cjs
  - restore-drill.cjs
  - demo-stories.md
  - e2e-contract.json
  - specs for tenant isolation / privileged actions / audit immutability
