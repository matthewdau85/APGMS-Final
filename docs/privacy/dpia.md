# Data Protection Impact Assessment (DPIA)

## Overview

This DPIA documents how the platform processes personal data, identifies privacy risks, and records
mitigations to demonstrate compliance with GDPR and similar privacy regimes.

## System Description

The platform provides subscription-based analytics to enterprise customers. Personal data collected includes
user profile details, authentication credentials, product interaction telemetry, and support communications.
Processing occurs in the EU and US regions with regional data residency honored per tenant settings.

## Data Flows

| # | Data Subject & Data Category | Source | Destination | Purpose | Storage & Retention |
| --- | --- | --- | --- | --- | --- |
| 1 | Customer administrators – identification data (name, email), credentials | Admin UI | Identity service (PostgreSQL) | Account provisioning, authentication | Stored encrypted at rest; deleted 30 days after contract termination |
| 2 | End users – usage telemetry (pseudonymous IDs, feature usage events) | Web and mobile clients | Analytics pipeline → Data warehouse | Product analytics, roadmap prioritization | Aggregated after 90 days; raw events deleted after 30 days |
| 3 | Support contacts – conversation metadata and attachments | Support portal | Ticketing system (EU region) | Incident response, troubleshooting | Archived after 12 months and purged after 24 months |
| 4 | Billing contacts – invoicing details | Billing portal | Payment processor (PCI DSS compliant) | Subscription billing, dunning | Retained per statutory financial requirements (7 years) |
| 5 | Audit subjects – authentication and authorization logs | All services | Centralized logging platform | Security monitoring, compliance reporting | Retained 12 months by default; extended to 24 months for regulated tenants |

## Lawful Basis Assessment

| Processing Activity | Lawful Basis | Notes |
| --- | --- | --- |
| Account provisioning and authentication | Contract (Art. 6(1)(b)) | Required to deliver the subscribed service. |
| Usage telemetry for analytics | Legitimate Interests (Art. 6(1)(f)) | Legitimate interest assessment completed; opt-out available in account settings. |
| Support ticket processing | Contract & Legal Obligation | Needed to fulfill support SLAs and document incident handling. |
| Billing and invoicing | Legal Obligation | Necessary to comply with tax and accounting laws. |
| Security logging and monitoring | Legitimate Interests & Legal Obligation | Supports security operations and regulatory audit requirements. |

## Risk Assessment & Mitigations

| Risk | Impact | Likelihood | Mitigations | Residual Risk |
| --- | --- | --- | --- | --- |
| Unauthorized access to customer data | High | Medium | MFA enforced for admins, least-privilege RBAC, quarterly access reviews, anomaly detection alerts. | Low |
| Cross-border data transfer issues | Medium | Low | Standard Contractual Clauses in place, EU-hosted data residency option, continuous vendor due diligence. | Low |
| Excessive retention of telemetry data | Medium | Medium | Automated retention policies purge raw events after 30 days; aggregation pseudonymizes user IDs. | Low |
| Breach of support attachments containing PII | High | Low | Attachments encrypted at rest, virus scanning on upload, restricted access to support staff with background checks. | Low |
| Payment data compromise | High | Low | Payment processor maintains PCI DSS compliance; platform never stores cardholder data. | Low |
| Inadequate data subject rights handling | Medium | Medium | Automated DSAR workflows with 30-day SLA, privacy team oversight, audit logging of responses. | Low |

## Residual Risk & Approval

Residual risk after mitigations is assessed as **Low**. The DPIA is approved by the Data Protection Officer
and reviewed annually or whenever processing changes materially.
