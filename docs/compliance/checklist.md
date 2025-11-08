# Compliance Checklist

Run these checks before each release and record evidence in the release ticket:

- [ ] `pnpm compliance:evidence --tag <release-tag>` (store evidence file under `artifacts/compliance/<release-tag>.md`)
- [ ] Investigate and document any failing command results from the evidence run
- [ ] Confirm DPIA/ASVS documentation is current (`docs/privacy/dpia.md`, `docs/security/ASVS-mapping.md`, `docs/compliance/dpia-summary.md`)
- [ ] Review `docs/compliance/control-maps.md` for control/test drift and link updated evidence
- [ ] Ensure regulator/retention SOPs reflect latest onboarding/offboarding events (`docs/compliance/regulator-sop.md`, `docs/compliance/retention-worm-sop.md`)
- [ ] Ensure the security workflow (SBOM/SCA/Trivy/Gitleaks) succeeded in CI
- [ ] `pnpm smoke:regulator` and capture the console output in the release ticket (proves regulator portal endpoints respond with expected evidence).

Attach the generated evidence file and notes to the release artefact.
