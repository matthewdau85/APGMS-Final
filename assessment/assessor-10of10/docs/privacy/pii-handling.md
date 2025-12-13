# PII handling rules

PII includes:
- TFN
- names, addresses, contact info
- bank identifiers
- payroll and payment data where identifying

Rules:
- Minimize collection and storage
- Encrypt PII fields at rest (application or DB)
- Redact PII in logs, traces, and error messages
- Provide deletion/retention mechanisms per policy
