# Security Policy

## Contact
Email: security@yourdomain.example

## Transport Encryption
- **Mandatory mutual TLS** is enforced across all ingress paths. Services terminate TLS with server certificates issued from the platform PKI and verify client certificates against the regulated trust store. Requests without a valid client certificate are rejected with a 495 status code.
- Reverse proxies must forward `X-Forwarded-Proto=https` and preserve the original certificate chain in `X-Client-Cert`. The API gateway verifies the connection context before processing requests.
- Automated certificate rotation is handled through the existing secrets pipeline; certificate expiry alerts fire 30 days prior to rotation windows.

## Data Encryption at Rest
- AES-256-GCM envelope encryption is applied to all sensitive records. Data encryption keys are generated per record and wrapped by the platform Key Management Service (KMS).
- The active master key ID is rotated quarterly. Previous key versions remain in the KMS for decrypt-only operations until data re-encryption completes.
- Key custody is enforced through dual-approval change control. Key export is disabled; access requires just-in-time approval with hardware-backed MFA.

## Identity Assurance & MFA Coverage
- MFA is enforced for all privileged roles (`admin`, `finance`, `analyst`, and `auditor`). Users in these roles cannot authenticate unless TOTP or passkey factors are active.
- High-risk signals (new device fingerprints, geo-velocity anomalies, or IP reputation hits) trigger adaptive step-up challenges even for non-privileged users.
- Recovery flows require recent MFA verification; automated resets are blocked when device-risk scoring exceeds the medium threshold.

## Device Risk Analytics
- Device telemetry (device ID, user agent, IP reputation, geo, and behavioural anomaly scores) is recorded on each authentication attempt.
- Trusted-device baselines are maintained per organisation. Deviations beyond the configurable threshold are logged, alert on the security metrics dashboard, and require human approval for policy overrides.

## Operational Monitoring
- Security events feed Prometheus metrics (`security_events_total`, `device_risk_events_total`, `mfa_policy_enforcement_total`) that back Grafana alerts.
- All high-risk authentication attempts are chained into the tamper-evident audit log with SHA-256 hashes.

## Incident Response
- Security incidents must be reported within 1 hour of discovery. The on-call rotation is documented in `runbooks/ops.md`.
- Breach response playbooks include credential revocation, KMS key rotation, certificate revocation, and coordinated disclosure workflows.
