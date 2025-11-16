# Data Hosting & Sovereignty Statement
_Last reviewed: 1 Nov 2025_

## Hosting Footprint
| Environment | Provider | Region / AZs | Workloads |
| --- | --- | --- | --- |
| Production | AWS | ap-southeast-2a/b/c | Core API services, PostgreSQL, Redis, worker fleet, PayTo connectors |
| Disaster Recovery | AWS | ap-southeast-2 (pilot stack in standby VPC) | Warm standby of database replicas + stateless services, invoked during DR tests |
| Non-production | AWS | ap-southeast-2b | Staging and performance test clusters with anonymised datasets |

- No customer data (including TFN/ABN) leaves Australia. Build artifacts and telemetry stored in S3 buckets with `s3://apgms-*` naming policy enforced via SCP.
- Backup copies reside in cross-AZ S3 + AWS Backup vault configured for ap-southeast-2 only. Glacier Deep Archive is set to the same region.

## Sovereignty Controls
1. **Provider Contracts**: AWS Australia Pty Ltd with IRAP certification. PayTo/banking partners provide confirmation of Australian data centres in their data processing agreements.
2. **Network Guardrails**: Service Control Policies deny creation of resources in non-ap-southeast-2 regions for production accounts. GuardDuty + Config rules alert on violations.
3. **Access Management**: Admin access limited to Australian-based engineers with VPN + device compliance. Just-in-time elevation managed through Okta + AWS Identity Center.
4. **Audit Evidence**: Refer to `artifacts/osf/2025-11/sovereignty/topology-diagram.pdf` and `artifacts/osf/2025-11/sovereignty/aws-config-export.json` for topology proof.

## Failover & Approvals
- Recovery Time Objective (RTO): 4 hours. Recovery Point Objective (RPO): 15 minutes using logical replication slots across AZs.
- Quarterly DR tests (latest 22 Sep 2025) simulate AZ failure; runbook stored in `runbooks/dr-playbook.md` with sign-offs.
- Any proposal to use offshore failover (e.g., ap-southeast-1) would require written approval from the ATO Digital Partnership Office and OAIC. No such approval currently exists; offshore replication is disabled.
