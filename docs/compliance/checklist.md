# Compliance Checklist

Run these checks before each release and record evidence in the release ticket:

- [ ] `pnpm compliance:evidence --tag <release-tag>` (store evidence file under `artifacts/compliance/<release-tag>.md`)
- [ ] Investigate and document any failing command results from the evidence run
- [ ] Exercise the connectors capture endpoints (e.g., `/connectors/capture/payroll`) to deposit test PAYGW/GST funds and verify the generated evidence artifact is available to regulators (see docs/ops/regulator-portal.md).
- [ ] Confirm DPIA/ASVS documentation is current (`docs/privacy/dpia.md`, `docs/security/ASVS-mapping.md`)
- [ ] Ensure the security workflow (SBOM/SCA/Trivy/Gitleaks) succeeded in CI
- [ ] `pnpm smoke:regulator` and capture the console output in the release ticket (proves regulator portal endpoints respond with expected evidence).
- [ ] Capture monitoring evidence (run `node scripts/collect-monitoring-evidence.mjs` with `APGMS_MONITORING_TOKEN`, save artifacts/monitoring/<timestamp>) and link it from the release notes.

Attach the generated evidence file and notes to the release artefact.
