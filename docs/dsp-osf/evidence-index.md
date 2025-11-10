# DSP OSF Evidence Index

This index enumerates the artefacts maintained to demonstrate resilience, tamper-proof operations, and compliance with the data sharing commitments.

## Architecture Resilience Bundle
- **Artifacts**: `docs/architecture/ADR-001-platform-architecture.md`, `docs/ops/chaos.md`, `docs/ops/slo.md`
- **Highlights**: Active-active regional topology, automated failover playbooks, resilience testing outcomes.
- **Update Cadence**: Quarterly alongside the security attestation workshop.

## Operational SOP Packet
- **Artifacts**: `runbooks/ops.md`, `runbooks/ndb.md`, `docs/ops/runbook.md`, `docs/ops/logging.md`
- **Highlights**: Secure deletion workflows, regulator portal operating procedures, incident commander guides.
- **Update Cadence**: Post-incident or when process changes impact regulatory commitments.

## Compliance Metrics Dossier
- **Artifacts**: `docs/compliance/dsp-operational-framework.md`, `docs/security/ASVS-mapping.md`, `docs/risk/register.md`
- **Highlights**: Control coverage matrices, residual risk ratings, audit log integrity checks.
- **Update Cadence**: Published with quarterly security attestations and shared with compliance & legal stakeholders.

## Forensic Logging Manifest
- **Artifacts**: SIEM export manifest (stored in secure evidence bucket), attestation appendices, WORM storage hash catalogue.
- **Highlights**: Immutable log retention proof, tamper-evident hashing, chain-of-custody procedures.
- **Update Cadence**: Monthly verification with sign-off recorded in the governance sync minutes.
