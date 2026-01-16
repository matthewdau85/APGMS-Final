#!/usr/bin/env bash
set -euo pipefail
sed -i 's/\r$//' "$0" 2>/dev/null || true

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_URL_DEFAULT='postgresql://apgms:apgms@localhost:5432/apgms?schema=public'
export DATABASE_URL="${DATABASE_URL:-$DB_URL_DEFAULT}"

log(){ printf '[%(%FT%TZ)T] %s\n' -1 "$*"; }

kill_port() {
  ( fuser -k 3000/tcp 2>/dev/null || true
    lsof -ti :3000 -sTCP:LISTEN -Fp 2>/dev/null | sed 's/^p//' | xargs -r kill -9 || true ) || true
}

ensure_native_pg() {
  log "[pg] installing native Postgres (sudo required)"
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib
  log "[pg] starting service"
  sudo service postgresql start
  log "[pg] creating role/database"
  sudo -u postgres psql >/dev/null <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'apgms') THEN
    CREATE ROLE apgms LOGIN PASSWORD 'apgms';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'apgms') THEN
    CREATE DATABASE apgms OWNER apgms;
  END IF;
END$$;
SQL
}

ensure_docker_pg() {
  log "[pg] starting dockerized Postgres"
  docker rm -f apgms-postgres 2>/dev/null || true
  docker run -d --name apgms-postgres \
    -e POSTGRES_USER=apgms \
    -e POSTGRES_PASSWORD=apgms \
    -e POSTGRES_DB=apgms \
    -p 5432:5432 postgres:16
}

ensure_pg() {
  if command -v docker >/dev/null 2>&1; then
    ensure_docker_pg
  else
    ensure_native_pg
  fi
}

probe_db() {
  log "[pg] probing DB for readiness"
  for i in $(seq 1 30); do
    if pnpm -w exec prisma db execute --schema=infra/prisma/schema.prisma --stdin <<<'SELECT 1;' >/dev/null 2>&1; then
      log "[pg] DB is ready"
      return 0
    fi
    sleep 1
  done
  log "[pg] DB not ready in time"
  return 1
}

migrate_and_generate() {
  log "[prisma] migrate deploy"
  pnpm -w exec prisma migrate deploy --schema=infra/prisma/schema.prisma
  log "[prisma] generate client"
  pnpm -w exec prisma generate --schema=infra/prisma/schema.prisma
}

start_api() {
  kill_port
  log "[api] starting api-gateway (strict mode)"
  cd "$ROOT/services/api-gateway"
  unset DEV_READY_ALWAYS || true  # ensure strict path
  pnpm dev >"$ROOT/logs/api-gateway-$(date -u +%Y%m%dT%H%M%SZ).log" 2>&1 &
  API_PID=$!
  echo "$API_PID" > "$ROOT/logs/api-gateway.pid"
  log "[api] pid=$API_PID"
}

probe_ready() {
  log "[probe] /ready"
  for i in $(seq 1 60); do
    code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ready || true)
    if [ "$code" = "200" ]; then
      log "[probe] READY 200"
      return 0
    fi
    sleep 1
  done
  log "[probe] not ready; last headers:"
  curl -i http://127.0.0.1:3000/ready || true
  return 1
}

log "[fix] repo: $ROOT"
log "[step] ensure Postgres"
ensure_pg
probe_db
migrate_and_generate
start_api
probe_ready
log "[done] strict mode up"
