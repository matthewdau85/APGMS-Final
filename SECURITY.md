# Security Policy

Email: security@yourdomain.example

## Running security scans locally

The automated security workflow runs several tools that you can execute locally before opening a pull request.

### Prerequisites
- [pnpm](https://pnpm.io/) (after installing Node.js 18 or newer)
- [Docker](https://docs.docker.com/get-docker/) for container-based scanners

Install project dependencies once before running the pnpm-based commands:

```bash
pnpm install --frozen-lockfile
```

### Generate a CycloneDX SBOM

```bash
pnpm dlx @cyclonedx/cyclonedx-npm --output-format json --output-file artifacts/cyclonedx-sbom.json
```

The command creates a CycloneDX JSON bill of materials at `artifacts/cyclonedx-sbom.json`. The process exits with a non-zero status if SBOM generation fails.

### Run the dependency audit

```bash
pnpm audit --prod --audit-level=high --json > artifacts/pnpm-audit.json
```

This audit fails with exit code `1` when high or critical vulnerabilities are found. Review `artifacts/pnpm-audit.json` for the detailed report.

### Scan for secrets with Gitleaks

```bash
mkdir -p artifacts
status=0
docker run --rm \
  -v "$(pwd):/repo" \
  zricethezav/gitleaks:latest detect \
  --source=/repo \
  --report-path=/repo/artifacts/gitleaks-report.json \
  --report-format=json || status=$?
if [ ! -s artifacts/gitleaks-report.json ]; then
  echo '{}' > artifacts/gitleaks-report.json
fi
exit "$status"
```

Gitleaks exits with status `1` when potential secrets are detected. The JSON report is stored at `artifacts/gitleaks-report.json`.

### Run the Trivy file system scan

```bash
mkdir -p artifacts
status=0
docker run --rm \
  -v "$(pwd):/workspace" \
  -w /workspace \
  aquasec/trivy:0.49.1 fs \
  --format json \
  --output /workspace/artifacts/trivy-fs-report.json \
  --severity HIGH,CRITICAL \
  --exit-code 1 \
  /workspace || status=$?
if [ ! -s artifacts/trivy-fs-report.json ]; then
  echo '{}' > artifacts/trivy-fs-report.json
fi
exit "$status"
```

Trivy returns exit code `1` when high or critical vulnerabilities are detected. Inspect `artifacts/trivy-fs-report.json` for findings.
