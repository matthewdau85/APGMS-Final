# Security & Privacy Whitepaper (Procurement)

## Purpose
Provide procurement officers and security reviewers a concise summary of the security posture, privacy controls, and risk targets that support early-stage adoption discussions.

## Coverage
- **Status**: Prototype / in-progress tooling; security architecture follows Fastify zero-trust patterns with JWT auth, helmet headers, CORS allowlists.
- **Controls**: Encryption-in-flight via TLS, envelope-encrypted sensitive identifiers, and role-based access.
- **Monitoring**: Basic observability via metrics and logs; readiness/health endpoints exist for automation.

## Targets
This is a best-effort guide; no third-party certifications yet. The target is to evolve toward SOC2-Ready control mapping and to support procurement questionnaires with factual statements.
