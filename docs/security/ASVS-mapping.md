# OWASP ASVS L2

The table below tracks how the platform satisfies priority Application Security Verification Standard (ASVS) Level 2 controls. Each row links the control to the engineering artefact that demonstrates coverage today and highlights upcoming work to close any gaps.

| Control | Current | Planned | Evidence (file:line / workflow) |
| --- | --- | --- | --- |
| V2.1.1 – Enforce authenticated access to administrative functions | Administrative routes verify an `x-admin-token` header before servicing export or deletion requests. | Replace static admin token with signed service-to-service credentials issued by IAM. | `services/api-gateway/src/app.ts:109-189` |
| V3.3.1 – Protect sensitive identifiers in transit and at rest | TFNs are tokenised and encrypted using AES-256-GCM with audit logging hooks. | Automate KMS key rotation and publish audit metrics to the security dashboard. | `services/api-gateway/src/lib/pii.ts:1-120` |
| V5.1.2 – Validate and constrain inbound data payloads | JSON schemas constrain PII fields such as ABN and TFN token formats for connector ingestion. | Extend schema validation to all connector payloads and enforce with contract tests. | `services/api-gateway/src/schemas/pii.schema.json:1-28` |
| V7.2.3 – Log security-sensitive events with tamper resistance | The PII decrypt endpoint emits structured `security_event` logs through the Fastify logger integration. | Ship security logs to the central SIEM with immutability controls enabled. | `services/api-gateway/src/lib/pii.ts:63-108` |
| V14.2.3 – Maintain dependency hygiene with automated updates | Weekly dependency update checks cover npm packages and GitHub Actions. | Add alert routing to #sec-alerts and auto-merge policies for patch-level updates. | `.github/dependabot.yml` |

_Last reviewed: {{< today >}}_
