# Data classification

Classes:
- Public
- Internal
- Confidential
- Restricted (TFN, sensitive identifiers, regulated payloads)

Rules:
- Restricted data must be encrypted at rest and in transit.
- Restricted data must never be logged.
- Access to Restricted data requires explicit authorization and is auditable.
