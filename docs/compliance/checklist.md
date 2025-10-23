# Compliance Checklist

Run these checks before each release and record evidence in the release ticket:

- [ ] `pnpm compliance:evidence --tag <release-tag>` (store evidence file under `artifacts/compliance/<release-tag>.md`)
- [ ] Investigate and document any failing command results from the evidence run
- [ ] Confirm DPIA/ASVS documentation is current (`docs/privacy/dpia.md`, `docs/security/ASVS-mapping.md`)
- [ ] Ensure the security workflow (SBOM/SCA/Trivy/Gitleaks) succeeded in CI

Attach the generated evidence file and notes to the release artefact.
