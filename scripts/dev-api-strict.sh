#!/usr/bin/env bash
set -euo pipefail
docker rm -f apgms-postgres 2>/dev/null || true
docker run -d --name apgms-postgres \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=apgms \
  -p 5432:5432 postgres:16
export DATABASE_URL='postgresql://postgres:postgres@localhost:5432/apgms?schema=public'
cd "$(dirname "$0")/.."
pnpm -w exec prisma migrate deploy --schema=infra/prisma/schema.prisma
( fuser -k 3000/tcp 2>/dev/null || true; \
  lsof -ti :3000 -sTCP:LISTEN -Fp 2>/dev/null | sed 's/^p//' | xargs -r kill -9 || true )
cd services/api-gateway
pnpm dev
