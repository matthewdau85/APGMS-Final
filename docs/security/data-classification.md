\# Data Classification (APGMS)



This document defines APGMS data classification levels and required handling controls.

It is used as evidence for security governance and audit readiness.



\## Classification Levels



| Level | Name | Examples | Handling Requirements |

|---|---|---|---|

| L0 | Public | Marketing copy, public docs | No restrictions; integrity still required. |

| L1 | Internal | Non-sensitive operational docs | Access limited to staff; do not publish externally. |

| L2 | Confidential | Customer identifiers, invoices, account metadata | Strong access control (least privilege), audit logging, encryption at rest. |

| L3 | Restricted | TFN, bank account numbers, authentication secrets | Encryption in transit + at rest, strict role-based access, tamper-evident logs, redaction in logs. |

| L4 | Regulated / High Risk | Key material, master secrets, regulator-only evidence packs | Hardware-backed or envelope encryption, key rotation, explicit approvals, continuous monitoring. |



\## APGMS Data Map (Selected)



| Data Type | Classification | Storage | Notes |

|---|---|---|---|

| Org ID / User ID | L2 | Postgres (Prisma) | Treated as confidential identifiers. |

| Bank account details (BSB, account) | L3 | Encrypted fields | Must never appear in plaintext logs. |

| TFN | L3 | Encrypted fields | Redact always; access logged. |

| Audit events / access logs | L2–L3 | Postgres | Integrity is critical; append-only semantics preferred. |

| Evidence packs | L3–L4 | Artifacts store | Contains compliance evidence; restrict access. |



\## Logging and Redaction Rules



1\. Never log L3/L4 plaintext (TFN, account numbers, secrets).

2\. Use structured logging with explicit redaction.

3\. Security events must include: timestamp, orgId, principal, correlationId (when available).



\## Review / Ownership



\- Owner: Security \& Compliance

\- Review cadence: quarterly or after major scope changes



