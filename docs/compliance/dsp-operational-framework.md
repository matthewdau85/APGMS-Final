# DSP Operational Framework Control Matrix

| Requirement | Control Summary | Evidence Source | Owner | Status |
| --- | --- | --- | --- | --- |
| MFA for privileged access | Gateway exposes TOTP + WebAuthn enrolment and step-up gating for high-risk actions; rollout to all admins still in flight | services/api-gateway/src/routes/auth.ts, services/api-gateway/src/app.ts | Security | In progress |
| Security posture & incident response | Incident/NDB runbooks published with audit logging hooks; posture dashboards + on-call rotations still hardening | runbooks/ndb.md, docs/ops/runbook.md | Security/Ops | In progress |
| Penetration testing | Annual API/application pen test with remediation tracking | Pen test report, ticket references | Security | Planned |
| Data residency (AU) | Deploy production infrastructure in AU regions; restrict data export | Infra IaC, environment configs | Ops | Planned |
| TFN protections | Masking library, vault secrets, TFN SOP (`docs/security/TFN-SOP.md`) | Code references, SOP | Privacy | In progress |
| Logging & evidence | Manual `pnpm compliance:evidence` script captures artefacts; scheduling + retention automation pending | package.json (`compliance:evidence`), docs/ops/runbook.md | Ops | In progress |
| Privileged user inventory | `/security/users` lists scoped admins but `lastLogin` still mirrors `createdAt`; backlog to persist session telemetry for accurate reporting | services/api-gateway/src/app.ts:1981 | Security | Known gap |
| Change management | Feature freeze policy, blue/green deploy documentation | Release checklist | Product/Ops | Planned |
| Support & SLAs | Pilot support playbook, status site updates (`status/README.md`) | Support SOP | Customer Success | Planned |
