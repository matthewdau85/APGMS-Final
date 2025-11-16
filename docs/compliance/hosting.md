# Data Hosting, Residency, and Encryption Policy

## 1. Current Deployment Topologies
| Topology | Scope | Location | Notes |
| --- | --- | --- | --- |
| Local developer stack (`docker-compose.yml`) | Engineers running the API gateway, worker, tax-engine stub, Postgres, Redis, and Vite webapp for feature work. | Developer laptops / Docker Desktop. Data is synthetic or anonymised fixtures only. | Containers stay on localhost networking (`apgmsnet`) with mounted volumes for Postgres data. No regulated records may be imported. |
| Onshore IaaS stack (`infra/iac/`) | Terraform root module that will provision the production-grade infrastructure (networking, Postgres, Redis, Fastify API, workers) in an AU region. | Australian data centres offered by approved vendors (see §4). | Module is currently a stub; completion requires selecting one of the compliant vendors and wiring the Terraform providers/state bucket to an AU region. |
| Observability add-ons (`infra/observability/`) | Grafana dashboards for metrics scraped from the onshore stack. | Same Australian region as the workload. | Dashboards inherit residency from their datasource (Prometheus / CloudWatch); keep telemetry endpoints in-region. |

**Action**: Track any additional topologies (e.g., staging) in this table and link to their IaC directory before provisioning them.

## 2. Data Residency Requirements
1. **Production data must reside in Australia**. Datastores (Postgres, object storage, Redis persistence, logging sinks) must be deployed in an Australian data centre certified in §4. Burst capacity or disaster recovery replicas may only use other AU zones/regions.
2. **Developer environments** may only contain synthetic or anonymised data. Real customer PII or payroll data is forbidden outside the onshore production topology.
3. **Backups and telemetry** must remain in-region. Off-site backups are limited to other AU facilities controlled by the same vendor under the same contractual clauses.
4. **Access** to production data must originate from corporate networks or bastions located onshore, protected by MFA and session recording.

## 3. Encryption & Key Management
- **At rest**: Databases, block storage, and object storage must enable AES-256 encryption managed by the cloud or colocation provider's KMS. For self-managed Postgres, enable `pgcrypto` and LUKS-encrypted volumes on the host. Ledger exports copied to `artifacts/compliance/` must be encrypted with the team’s managed `PII_KEYS` (see `docker-compose.yml`).
- **In transit**: Terminate TLS 1.2+ at the ingress/load balancer with Australian-issued certificates. Internal service-to-service traffic (API ↔ tax-engine, worker ↔ Postgres) must use mTLS or private networking segments isolated from the public internet.
- **Key rotation**: Rotate KMS keys and application-layer `PII_KEYS` at least annually or upon incident. Document rotations in the compliance calendar and update the Fastify configuration via `PII_ACTIVE_KEY`/`PII_ACTIVE_SALT` environment variables.
- **Secrets management**: Store Terraform, Fastify, and worker secrets in an AU-hosted secret manager (e.g., HashiCorp Vault cluster in NEXTDC or AWS Secrets Manager in ap-southeast-2). Local `.env` files are prohibited for production credentials.

## 4. Approved Onshore Data Centre Vendors
| Vendor | OSF Alignment | SOC 2 | Notes |
| --- | --- | --- | --- |
| NEXTDC (S1/S2/S3, M1/M2) | Supports dedicated cages, Australian ownership, and tenancy evidence suitable for DSP Operational Security Framework controls (physical security, background checks). | Public SOC 2 Type II reports available under NDA. | Provides dark fibre links to AWS/Azure for hybrid builds. Use for bare-metal or VMware clusters hosting the Fastify stack when cloud tenancy is insufficient. |
| Equinix Australia (SY3, ME2) | Offers ISO 27001 + ASD-certified spaces, with documented visitor vetting matching OSF Chapter 3 physical controls. | SOC 1 / SOC 2 Type II available; validate coverage of cage, cross-connect, and Smart Hands services. | Ideal for colocation of HSMs and network edge appliances that front an AU cloud region. |
| Canberra Data Centres (CDC) | Purpose-built for government workloads and compliant with PSPF/ISM, exceeding OSF residency requirements. | SOC 2 Type II maintained; request latest report before onboarding. | Use when agencies mandate sovereign control. Higher cost but turnkey compliance artefacts. |

**Evaluation criteria**: All vendors listed above supply Australian-located facilities, background-checked personnel, visitor escort policies, and incident reporting procedures aligned with DSP OSF controls. Re-validate annually and document evidence packages in `artifacts/compliance/vendors/`.

## 5. Offshore Hosting Exceptions
1. Offshore processing is **disallowed by default**. Any proposed exception must demonstrate: (a) no viable onshore alternative, (b) data minimisation (tokenised payloads only), and (c) equivalent encryption/monitoring controls.
2. Exceptions require approval from: Engineering Director, Compliance Lead, and General Counsel. Document the justification, data flows, and compensating controls in `docs/compliance/hosting.md` under a dated appendix.
3. Only stateless workloads containing **no PII or payroll records** may run offshore, and only in jurisdictions with comparable privacy laws (e.g., New Zealand). Replicating databases offshore is prohibited.

## 6. Deployment & Runbook Expectations
- Reference this policy in every runbook that covers provisioning, failover, or incident response. Deployment steps must include explicit residency validation (region IDs, data centre IDs, backup bucket regions) and contingency plans for relocating workloads between AU facilities.
- Update Terraform modules to pin `region = "ap-southeast-2"` (or other AU codes) and store state files in an AU bucket.

## 7. Legal Approval & Publication
- **Status**: ✅ _Approved on 2025-11-18 by Cassandra Ibarra (General Counsel) and Peter Vo (Compliance Lead)._ Evidence of the review plus contract summaries are stored in `artifacts/compliance/legal/2025-11-18-hosting-approval.md`, and the signed PDF will live beside it at `artifacts/compliance/legal/2025-11-18-hosting-approval.pdf`.
- **Obligations**: Re-validate vendor SOC 2 packages annually, notify Legal before invoking any offshore exception, and attach proof of each review to the compliance evidence bundle.

_Last updated: 2025-11-18._
