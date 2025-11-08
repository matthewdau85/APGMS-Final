# Status Site Guidance

Update this directory when publishing incident notes, maintenance windows, or dashboard links.

- Store incident timelines in `status/incidents/<yyyymmdd>-<slug>.md` (link Prometheus/Grafana dashboards from `docs/ops/dashboards.md`).
- Include links to accessibility smoke reports (`docs/accessibility/smoke.md`) and
  compliance evidence (`docs/compliance/checklist.md`,
  `docs/compliance/control-maps.md`).
- Note regulator onboarding/offboarding updates and link to the associated SOP
  entry (`docs/compliance/regulator-sop.md`).
- Record retention/WORM reviews with artifact IDs so auditors can trace evidence
  quickly (`docs/compliance/retention-worm-sop.md`).
- After each release, summarise health checks (k6 smoke, readiness, CI status) here for customer visibility.

