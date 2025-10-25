# Risk Register

| ID | Risk Statement | Impact | Mitigation | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| R-001 | Synthetic demo data leaks into production tenants | High | Isolate simulation tenants, prefix synthetic metrics, purge data on disable | Engineering Lead | Open |
| R-002 | Bank API outage during BAS window delays remittance | High | Queue retries, readiness pre-checks, manual override runbook | Ops Lead | Open |
| R-003 | Tax tables drift from ATO published rates | Medium | Automate rate ingestion, add regression tests, monthly SME review | Tax SME | Open |
| R-004 | DSP admin account compromise | High | Enforce MFA, anomaly detection, credential rotation, session revocation tooling | Security Lead | Planned |
| R-005 | TFN storage breaches Privacy/TFN Rule obligations | Medium | Vault-managed secrets, periodic audits, masking enforcement | Privacy Officer | Planned |
