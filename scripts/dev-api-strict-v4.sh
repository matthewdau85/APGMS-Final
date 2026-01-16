#!/usr/bin/env bash
set -euo pipefail
sed -i 's/\r$//' "$0" 2>/dev/null || true

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT/logs"
API_LOG="$LOG_DIR/api-gateway-$(date -u +%Y%m%dT%H%M%SZ).log"
PID_FILE="$LOG_DIR/api-gateway.pid"
mkdir -p "$LOG_DIR"

DB_URL_DEFAULT='postgresql://apgms:apgms@localhost:5432/apgms?schema=public'
export DATABASE_URL="${DATABASE_URL:-$DB_URL_DEFAULT}"
PSQL_URL="${DATABASE_URL%%\?*}"   # strip ?schema=...

log(){ printf '[%(%FT%TZ)T] %s\n' -1 "$*"; }

kill_port_3000(){
  ( fuser -k 3000/tcp 2>/dev/null || true
    lsof -ti :3000 -sTCP:LISTEN -Fp 2>/dev/null | sed 's/^p//' | xargs -r kill -9 || true ) || true
}

ensure_pg_native(){
  log "[pg] installing Postgres & client (sudo required)"
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib postgresql-client

  # detect cluster dir
  CLVER="$(pg_lsclusters -h 2>/dev/null | awk 'NR==2{print $1}')" || true
  [ -z "${CLVER:-}" ] && CLVER="16"
  CLNAME="$(pg_lsclusters -h 2>/dev/null | awk 'NR==2{print $2}')" || true
  [ -z "${CLNAME:-}" ] && CLNAME="main"

  CONF_DIR="/etc/postgresql/$CLVER/$CLNAME"
  PGCNF="$CONF_DIR/postgresql.conf"
  HBA="$CONF_DIR/pg_hba.conf"

  log "[pg] configuring listen_addresses=127.0.0.1"
  sudo sed -i "s/^[#[:space:]]*listen_addresses.*/listen_addresses = '127.0.0.1'/" "$PGCNF" || true
  grep -q "listen_addresses = '127.0.0.1'" "$PGCNF" || echo "listen_addresses = '127.0.0.1'" | sudo tee -a "$PGCNF" >/dev/null

  log "[pg] ensuring pg_hba allows local TCP (scram-sha-256)"
  if ! grep -q "^host[[:space:]]\+all[[:space:]]\+all[[:space:]]\+127\.0\.0\.1/32[[:space:]]\+scram-sha-256" "$HBA"; then
    echo "host all all 127.0.0.1/32 scram-sha-256" | sudo tee -a "$HBA" >/dev/null
  fi
  if ! grep -q "^host[[:space:]]\+all[[:space:]]\+all[[:space:]]\+::1/128[[:space:]]\+scram-sha-256" "$HBA"; then
    echo "host all all ::1/128 scram-sha-256" | sudo tee -a "$HBA" >/dev/null
  fi

  log "[pg] restarting service"
  sudo service postgresql restart

  log "[pg] creating role/database if missing"
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='apgms'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE ROLE apgms LOGIN PASSWORD 'apgms'"
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='apgms'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE DATABASE apgms OWNER apgms"
}

probe_db(){
  log "[pg] probing TCP :5432 as apgms@apgms"
  for i in $(seq 1 90); do
    if command -v pg_isready >/dev/null 2>&1; then
      if pg_isready -h 127.0.0.1 -p 5432 -d apgms -U apgms -q; then
        log "[pg] pg_isready ok"
        return 0
      fi
    fi
    PGPASSWORD=apgms psql "postgresql://apgms:apgms@127.0.0.1:5432/apgms" -tAc 'SELECT 1' >/dev/null 2>&1 && { log "[pg] psql ok"; return 0; }
    sleep 1
  done
  log "[pg] DB not ready in time"
  return 1
}

migrate_and_generate(){
  log "[prisma] migrate deploy"
  pnpm -w exec prisma migrate deploy --schema=infra/prisma/schema.prisma
  log "[prisma] generate"
  pnpm -w exec prisma generate --schema=infra/prisma/schema.prisma
}

start_api(){
  kill_port_3000
  log "[api] starting api-gateway (STRICT)"
  cd "$ROOT/services/api-gateway"
  unset DEV_READY_ALWAYS || true
  pnpm dev >"$API_LOG" 2>&1 & echo $! > "$PID_FILE"
  log "[api] pid=$(cat "$PID_FILE") log=$API_LOG"
}

probe_ready(){
  log "[probe] GET /ready"
  for i in $(seq 1 120); do
    code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ready || true)
    [ "$code" = "200" ] && { body=$(curl -s http://127.0.0.1:3000/ready || true); log "[probe] READY 200 body=$body"; return 0; }
    sleep 1
  done
  log "[probe] not ready; last headers/body then api log tail"
  curl -i http://127.0.0.1:3000/ready || true
  tail -n 200 "$API_LOG" || true
  return 1
}

log "[fix] repo: $ROOT"
ensure_pg_native
probe_db
migrate_and_generate
start_api
probe_ready
log "[done] strict mode up"
