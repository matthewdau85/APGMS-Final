# ATO DSP Readiness Checklist

| Regulatory Requirement | Description | Responsible Services |
| --- | --- | --- |
| Identity and Access Management | Enforce strong authentication, least privilege, and credential lifecycle controls. | services/api-gateway, services/connectors |
| Data Encryption | Ensure encryption in transit and at rest with managed keys and monitoring. | services/api-gateway, services/connectors, worker/ |
| Audit and Logging | Provide immutable, centralised logs with retention and correlation to user actions. | services/api-gateway, services/connectors, worker/ |
| Change Management | Document and approve production changes with rollback and segregation of duties. | services/api-gateway, worker/ |
| Incident Response | Maintain playbooks, escalation contacts, and post-incident reviews meeting ATO timelines. | services/api-gateway, services/connectors |
| Vulnerability Management | Perform scanning, patching, and penetration testing aligned with DSP cadence. | services/api-gateway, services/connectors |
| Data Governance | Track lineage, retention, and anonymisation for datasets used in DSP services. | services/connectors, worker/ |
| Business Continuity | Deliver backup, restoration, and failover procedures validated by periodic testing. | services/api-gateway, worker/ |
| Privacy Compliance | Implement consent management, data minimisation, and customer disclosure processes. | services/api-gateway, services/connectors |
| Supplier Management | Assess and monitor third-party integrations impacting DSP obligations. | services/connectors |
