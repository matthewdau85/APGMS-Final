# TFN handling SOP

This SOP outlines how Tax File Numbers (TFNs) are collected, stored, accessed, and audited across the platform. We document the live controls in place today and call out honest follow-up work using unchecked tasks.

| Process Step | Current Control | Planned Control | Owner | Evidence |
| --- | --- | --- | --- | --- |
| Collection & tokenisation | TFNs are validated and converted into irreversible tokens using keyed HMACs, ensuring only the token leaves the request boundary (`services/api-gateway/src/lib/pii.ts`). | - [ ] Source TFN tokenisation salts from a managed secret store and rotate via automation (TBD – create PR). | Data Protection (PII working group) | [`services/api-gateway/src/lib/pii.ts`](../../services/api-gateway/src/lib/pii.ts)<br>[CI workflow](https://github.com/matthewdau85/APGMS-Final/actions/workflows/ci.yml) |
| Storage & encryption | The PII module encrypts sensitive payloads with AES-256-GCM and key identifiers before they are persisted, preventing direct TFN storage at rest (`services/api-gateway/src/lib/pii.ts`). | - [ ] Define infrastructure-as-code for provisioning dedicated KMS keys and rotation schedules (TBD – create PR). | Platform Security Engineering | [`services/api-gateway/src/lib/pii.ts`](../../services/api-gateway/src/lib/pii.ts)<br>[`services/api-gateway/test/pii.spec.ts`](../../services/api-gateway/test/pii.spec.ts) |
| Access requests | Administrative decrypt requests must pass a guard callback and generate an audit record before plaintext TFNs are returned (`services/api-gateway/src/lib/pii.ts`). | - [ ] Integrate the admin guard with centrally managed IAM policies and on-call approvals (TBD – create PR). | Security Operations | [`services/api-gateway/src/lib/pii.ts`](../../services/api-gateway/src/lib/pii.ts)<br>[CI workflow](https://github.com/matthewdau85/APGMS-Final/actions/workflows/ci.yml) |
| Incident response | TFN-related breaches follow the existing Notifiable Data Breach runbook, including notification templates and containment guidance (`runbooks/ndb.md`). | - [ ] Draft a TFN-specific annex covering regulator timelines and deletion workflows (TBD – create PR). | Compliance & Legal | [`runbooks/ndb.md`](../../runbooks/ndb.md) |

Future SOP revisions will link to the relevant change PRs once work is scheduled and delivered.
