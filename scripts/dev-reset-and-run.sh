#!/usr/bin/env bash
set -euo pipefail

log() { printf "\n[%s] %s\n" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$*"; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

ADMIN_TOKEN="${INTERNAL_ADMIN_TOKEN:-dev-admin-token}"
API_HOST="${HOST:-127.0.0.1}"
API_PORT="${PORT:-3000}"
VITE_HOST="127.0.0.1"
VITE_PORT="5173"

kill_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      log "Killing listeners on :$port -> ${pids}"
      kill -9 ${pids} 2>/dev/null || true
    fi
  fi
}

log "0) Normalize line endings (LF) for scripts and key TS/TSX"
find scripts services/api-gateway webapp -type f \
  \( -name "*.sh" -o -name "*.ts" -o -name "*.tsx" -o -name "*.mts" -o -name "*.mjs" -o -name "*.json" -o -name "*.html" \) \
  -print0 2>/dev/null | xargs -0 sed -i 's/\r$//' || true

log "1) Kill old dev processes"
pkill -f "vite/bin/vite\.js" 2>/dev/null || true
pkill -f "tsx watch src/index\.ts" 2>/dev/null || true
pkill -f "services/api-gateway" 2>/dev/null || true
kill_port "$API_PORT"
kill_port "$VITE_PORT"

log "2) Remove dangerous stray .js artifacts in api-gateway/src (these cause the export mismatch)"
# Only remove JS artifacts inside api-gateway/src (NOT dist, NOT node_modules)
# This specifically prevents tsx/node from importing wrong runtime modules.
if [[ -d "services/api-gateway/src" ]]; then
  find services/api-gateway/src -type f \( -name "*.js" -o -name "*.js.map" \) -print -delete || true
fi

log "3) Ensure webapp AdminArea has the named export App.tsx expects"
mkdir -p webapp/src/admin
cat > webapp/src/admin/AdminArea.tsx <<'EOF'
import { Routes, Route, Navigate, Link } from "react-router-dom";
import { useMemo, useState } from "react";

import { AgentPage } from "./pages/AgentPage";
import { RegWatcherPage } from "./pages/RegWatcherPage";

function getAdminTokenFromEnvOrStorage(): string {
  const fromEnv = (import.meta as any).env?.VITE_ADMIN_TOKEN;
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  const fromStorage = localStorage.getItem("apgms_admin_token");
  return (fromStorage ?? "").trim();
}

export function AdminArea() {
  const [token, setToken] = useState<string>(() => getAdminTokenFromEnvOrStorage());

  const nav = useMemo(() => {
    return [
      { to: "/admin/agent", label: "Agent" },
      { to: "/admin/regwatcher", label: "RegWatcher" },
    ];
  }, []);

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>
      <h1 style={{ margin: 0, fontSize: 20 }}>Admin</h1>

      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, opacity: 0.85 }}>
          x-admin-token:
          <input
            value={token}
            onChange={(e) => {
              const v = e.target.value;
              setToken(v);
              localStorage.setItem("apgms_admin_token", v);
            }}
            placeholder="dev-admin-token"
            style={{
              marginLeft: 8,
              padding: "8px 10px",
              width: 320,
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.2)",
            }}
          />
        </label>

        <div style={{ display: "flex", gap: 10 }}>
          {nav.map((n) => (
            <Link key={n.to} to={n.to} style={{ textDecoration: "none", fontSize: 13 }}>
              {n.label}
            </Link>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/admin/agent" replace />} />
          <Route path="/agent" element={<AgentPage adminToken={token} />} />
          <Route path="/regwatcher" element={<RegWatcherPage adminToken={token} />} />
          <Route path="*" element={<Navigate to="/admin/agent" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default AdminArea;
EOF

log "4) Ensure webapp App.tsx routes /admin/* to AdminArea (named export)"
mkdir -p webapp/src/app
cat > webapp/src/app/App.tsx <<'EOF'
import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "../pages/LoginPage";
import BasPage from "../pages/BasPage";
import CompliancePage from "../pages/CompliancePage";
import AlertsPage from "../pages/AlertsPage";
import FeedsPage from "../pages/FeedsPage";

import ProtectedLayout from "../layouts/ProtectedLayout";
import { AdminArea } from "../admin/AdminArea";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<BasPage />} />
        <Route path="/bas" element={<BasPage />} />
        <Route path="/compliance" element={<CompliancePage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/feeds" element={<FeedsPage />} />

        <Route path="/admin/*" element={<AdminArea />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
EOF

log "5) Write webapp dev env (API base + admin token)"
cat > webapp/.env.local <<EOF
VITE_API_BASE_URL=http://${API_HOST}:${API_PORT}
VITE_ADMIN_TOKEN=${ADMIN_TOKEN}
EOF

log "6) Install deps (safe to re-run)"
pnpm install --frozen-lockfile

log "7) Typecheck api-gateway (fail-fast)"
pnpm -C services/api-gateway typecheck

log "8) Clear Vite cache (prevents stuck optimizer state)"
rm -rf webapp/node_modules/.vite webapp/.vite 2>/dev/null || true

log "9) Start API + Vite (background) with logs"
mkdir -p /tmp/apgms
API_LOG="/tmp/apgms/api.log"
VITE_LOG="/tmp/apgms/vite.log"

(
  cd "$REPO_ROOT"
  export INTERNAL_ADMIN_TOKEN="$ADMIN_TOKEN"
  export HOST="$API_HOST"
  export PORT="$API_PORT"
  pnpm -C services/api-gateway dev
) >"$API_LOG" 2>&1 &

API_PID="$!"
log "API PID=$API_PID (log: $API_LOG)"

(
  cd "$REPO_ROOT"
  pnpm -C webapp dev -- --host "$VITE_HOST" --port "$VITE_PORT" --strictPort
) >"$VITE_LOG" 2>&1 &

VITE_PID="$!"
log "VITE PID=$VITE_PID (log: $VITE_LOG)"

log "10) Wait for ports to be listening"
for i in $(seq 1 60); do
  api_up="no"
  vite_up="no"
  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$API_PORT" -sTCP:LISTEN >/dev/null 2>&1 && api_up="yes" || true
    lsof -tiTCP:"$VITE_PORT" -sTCP:LISTEN >/dev/null 2>&1 && vite_up="yes" || true
  fi

  if [[ "$api_up" == "yes" && "$vite_up" == "yes" ]]; then
    break
  fi
  sleep 0.25
done

log "Dev URLs"
echo "API : http://${API_HOST}:${API_PORT}"
echo "WEB : http://localhost:${VITE_PORT}/"
echo "ADM : http://localhost:${VITE_PORT}/admin/agent"

log "11) Quick admin route probe (expects 200)"
curl -sS -H "x-admin-token: ${ADMIN_TOKEN}" "http://${API_HOST}:${API_PORT}/admin/agent/runs" || true
echo

log "DONE. If anything fails, inspect logs:"
echo "$API_LOG"
echo "$VITE_LOG"
