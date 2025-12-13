# Disaster recovery (DR)

Objectives:
- RTO (Recovery Time Objective): <define>
- RPO (Recovery Point Objective): <define>

Systems:
- Database (Postgres)
- Redis
- API gateway
- Worker

Recovery steps (high-level):
1) Restore database from latest backup
2) Apply migrations
3) Restore configuration/secrets
4) Bring up services
5) Run smoke tests and readiness checks
6) Validate ledger integrity + audit chain

Drills:
- Perform restore drill at least quarterly.
- Capture evidence artifacts and archive them in evidence packs.
