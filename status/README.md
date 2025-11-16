# Status Site Guidance

Update this directory when publishing incident notes, maintenance windows, or dashboard links.

- Store incident timelines in `status/incidents/<yyyymmdd>-<slug>.md` (link Prometheus/Grafana dashboards from `docs/ops/dashboards.md`).
- Include links to accessibility smoke reports (`docs/accessibility/smoke.md`) and compliance evidence (`docs/compliance/checklist.md`).
- After each release, summarise health checks (k6 smoke, readiness, CI status) here for customer visibility.
- Track regulatory filings: latest ATO DSP product registration (`DSP-PRD-8742`) is documented in `runbooks/compliance/ato-dsp-registration.md`; post-release updates should include a reminder that OSF/STP evidence lives under `docs/dsp-osf/evidence-index.md`.

