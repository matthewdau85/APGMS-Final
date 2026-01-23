# APGMS Agent Brief

This repository implements APGMS (Automated PAYGW and GST Management System).
The system must support:
- Designated one-way accounts for PAYGW and GST (deposit-only, tamper-resistant).
- Real-time PAYGW calculation (payroll integration) and real-time GST calculation (POS integration).
- BAS lodgment gate: verify funds are available and then remit at BAS lodgment.
- Reconciliation, discrepancy logging, alerts, and audit-grade compliance reporting.
- Security controls such as MFA, encryption-in-transit, and fraud/anomaly monitoring.

Codex must:
- Prevent contract drift (backend <-> frontend).
- Keep tests green and readiness green.
- Keep DSP/OSF evidence docs coherent and current.
