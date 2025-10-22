# Security Policy

We take the security of the APGMS platform seriously and appreciate coordinated disclosure from the community.

## Reporting a vulnerability

- Email security@birchal.com with a clear description of the issue, affected components, and any proof-of-concept material.
- Encrypt sensitive details with our PGP key published at https://birchal.com/security/pgp if possible.
- Please provide a way for us to contact you for follow-up questions.

## What to expect

- We will acknowledge receipt within two business days.
- Triage updates will be provided at least weekly while we investigate.
- We aim to release a remediation or mitigation plan within 30 days for high-severity reports.

## Safe harbour

Birchal will not pursue legal action against researchers who follow this policy and make a good-faith effort to avoid privacy violations, service disruption, or destruction of data.

## Automation

- Dependency changes require pull requests to pass dependency review plus high/critical npm audit checks; weekly scheduled jobs
  rerun the audits across both production and development dependencies.
- Trivy vulnerability scanning runs against the repository weekly to detect disclosed issues beyond npm advisory coverage.
- Continuous secret scanning with Gitleaks blocks leaked credentials and publishes SARIF reports for review.
- An OSSF Scorecard run and SBOM generation (SPDX) are published from GitHub Actions on a weekly cadence to inform ongoing supply-chain monitoring, and each SBOM is signed via Sigstore keyless signing.
- Web application build artifacts are packaged automatically, hashed, and signed with Sigstore in CI; a follow-up verification
  job enforces the signature and validates the generated SLSA provenance before downstream stages run.
- End-to-end Playwright smoke tests join the build, unit, accessibility, and Lighthouse gates to prevent regressions before changes merge.
- Container images for the API gateway, tax engine, and webapp are rebuilt and scanned with Trivy, uploading SARIF results for
  triage.
- The release workflow rebuilds from trusted refs, reruns the full build/test/type-check suite, and publishes the signed build,
  SBOM, and SLSA provenance to GitHub Releases after verifying each signature and attestation against the workflow's Sigstore
  identity.
