Runbook: DB readiness

* The gateway reads its database name from `DATABASE_URL` (default `apgms`). `scripts/readiness/fix-local-readiness.sh` and `scripts/readiness/fix-db-testdb.sh` now derive the DB name automatically and only mention `testdb` if you explicitly override `TARGET_DB`.

1. Discover containers/services:
   ```bash
   docker compose ps
   docker compose config --services
   ```

2. Start compose stack (if not already running):
   ```bash
   docker compose up -d
   ```

3. Watch DB logs until ready (use service name from compose):
   ```bash
   docker compose logs -f <db-service-name>
   ```

4. Hit readiness endpoint:
   ```bash
   curl -i http://localhost:3000/ready
   ```
   Expect HTTP 200 with `{ "ok": true, ... }`.

5. Run global readiness checks:
   ```bash
   pnpm readiness:all
   pnpm readiness:chain

Optional: run the bundled script instead of copy/pasting:
```bash
./scripts/readiness/run-db-ready.sh
```
   ```
