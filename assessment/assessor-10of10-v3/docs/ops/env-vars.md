# Environment Variables

This document lists APGMS environment variables by service, classification, and environment.

## Conventions
- Secrets are injected via secret manager or CI/CD secret store (never committed).
- Non-secret config is provided via environment variables or config files.

## Required minimum variables (examples)
- DATABASE_URL (secret)
- REDIS_URL (secret)
- OTEL_EXPORTER_OTLP_ENDPOINT (non-secret)
- LOG_LEVEL (non-secret)
