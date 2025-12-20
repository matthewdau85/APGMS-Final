# EV-013 – AU Tax Config Provider Contract Tests

## Control Objective
Ensure AU tax configuration providers and repositories behave
deterministically and independently of persistence mechanisms.

## Scope
- PAYGW configuration resolution
- Repository behavior without Prisma
- Guarding PAYGW engine inputs

## Evidence
- In-memory provider contract tests
- Repository abstraction validated independently of database
- Engine rejects missing or malformed PAYGW configs

## Rationale
This control allows:
- Safe evolution of tax configuration sources
- Confidence in PAYGW calculations
- Decoupling of domain logic from infrastructure

## Related Artifacts
- `src/au-tax/tax-config-repo.from-provider.ts`
- `src/au-tax/resolve-au-tax-config.ts`
- PAYGW engine unit tests

## DSP OSF Index
- `docs/compliance/dsp-osf-evidence-index.md`
