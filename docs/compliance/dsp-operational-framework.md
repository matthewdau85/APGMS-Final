# DSP Operational Framework Control Matrix

| Requirement | Control Summary | Evidence Source | Owner | Status |
| --- | --- | --- | --- | --- |
| MFA for privileged access | Enforce WebAuthn/TOTP in API gateway and admin portal | Phase 2 stories, auth configuration | Security | Planned |
| Security posture & incident response | Incident runbook (`runbooks/ndb.md`), audit logging, 24h notification commitment | Runbook updates, audit log pipeline | Security/Ops | Planned |
| Penetration testing | Annual API/application pen test with remediation tracking | Pen test report, ticket references | Security | Planned |
| Data residency (AU) | Deploy production infrastructure in AU regions; restrict data export | Infra IaC, environment configs | Ops | Planned |
| TFN protections | Masking library, vault secrets, TFN SOP (`docs/security/TFN-SOP.md`) | Code references, SOP | Privacy | In progress |
| Logging & evidence | Immutable audit log pipeline + nightly evidence job (`pnpm compliance:evidence`) | Evidence artifacts | Ops | Planned |
| Change management | Feature freeze policy, blue/green deploy documentation | Release checklist | Product/Ops | Planned |
| Support & SLAs | Pilot support playbook, status site updates (`status/README.md`) | Support SOP | Customer Success | Planned |
