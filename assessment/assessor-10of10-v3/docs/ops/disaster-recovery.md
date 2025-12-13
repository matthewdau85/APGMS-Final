# Disaster Recovery Plan

## Scope
APGMS core services, databases, and critical integrations.

## Targets
- RTO: 4 hours
- RPO: 15 minutes

## Backup strategy
- Daily full backups + incremental
- Store backups in separate account/bucket
- Periodic restore validation

## Restore procedure (high level)
1. Provision fresh environment
2. Restore database snapshot
3. Restore application services
4. Run integrity checks
5. Validate key flows (health, auth, exports)

## Restore validation
Use scripts/assessor/restore-drill.cjs to run a repeatable restore drill.
