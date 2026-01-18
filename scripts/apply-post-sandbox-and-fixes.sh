#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# APGMS: Apply post fixes + sandbox, with full logging
# =============================================================================

ROOT="${HOME}/src/APGMS"
LOG_DIR="${ROOT}/logs"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="${LOG_DIR}/apply-post-sandbox-and-fixes-${RUN_ID}.log"

mkdir -p "${LOG_DIR}"

# Tee ALL output (stdout+stderr) to log file
exec > >(tee -a "${LOG_FILE}") 2>&1

echo "== APGMS: apply-post-sandbox-and-fixes =="
echo "[run_id] ${RUN_ID}"
echo "[log] ${LOG_FILE}"
echo "[pwd] $(pwd)"
echo

die() {
  echo
  echo "[FAIL] $*"
  echo "[log] ${LOG_FILE}"
  exit 1
}

on_err() {
  local exit_code="$1"
  local line_no="$2"
  local cmd="$3"
  echo
  echo "[ERROR] exit_code=${exit_code} at line=${line_no}"
  echo "[ERROR] command: ${cmd}"
  echo "[log] ${LOG_FILE}"
  exit "${exit_code}"
}

trap 'on_err $? $LINENO "$BASH_COMMAND"' ERR

run() {
  echo
  echo "------------------------------------------------------------"
  echo "[cmd] $*"
  echo "------------------------------------------------------------"
  "$@"
}

# Sanity
[ -d "${ROOT}" ] || die "Missing repo root: ${ROOT}"

run cd "${ROOT}"

###############################################################################
# 1) Fix duplicate newRoutes import / registration in api-gateway/src/app.ts
###############################################################################
APP="services/api-gateway/src/app.ts"
[ -f "${APP}" ] || die "Missing ${APP}"

echo
echo "[1/6] Deduplicating newRoutes import/registration in ${APP}"

tmp="$(mktemp)"
run awk '
  BEGIN { seenImport=0; seenRegister=0 }
  {
    # Match import newRoutes from "./routes/new-routes.js";
    if ($0 ~ /^import[[:space:]]+newRoutes[[:space:]]+from[[:space:]]+".*\/routes\/new-routes\.js";?[[:space:]]*$/) {
      if (!seenImport) { print; seenImport=1 }
      next
    }
    # Match app.register(newRoutes);
    if ($0 ~ /^[[:space:]]*app\.register\(newRoutes\);[[:space:]]*$/) {
      if (!seenRegister) { print; seenRegister=1 }
      next
    }
    print
  }
' "${APP}" > "${tmp}"
run mv "${tmp}" "${APP}"
echo "[ok] Dedup completed"

###############################################################################
# 2) Ensure alerts route exists (API)
###############################################################################
echo
echo "[2/6] Writing alerts route plugin"

run mkdir -p services/api-gateway/src/routes

cat > services/api-gateway/src/routes/alerts.ts <<'TS'
import type { FastifyPluginAsync } from 'fastify';

type Alert = {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
};

const store: Record<string, Alert> = {
  a1: {
    id: 'a1',
    title: 'Unreconciled bank lines',
    severity: 'high',
    status: 'open',
    createdAt: new Date().toISOString(),
  },
  a2: {
    id: 'a2',
    title: 'Designated account shortfall',
    severity: 'medium',
    status: 'open',
    createdAt: new Date().toISOString(),
  },
};

const alertsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { status?: 'open' | 'resolved' } }>(
    '/alerts',
    async (req) => {
      const status = req.query.status;
      const all = Object.values(store);
      return status ? all.filter(a => a.status === status) : all;
    }
  );

  app.post<{ Params: { id: string } }>(
    '/alerts/:id/resolve',
    async (req) => {
      const a = store[req.params.id];
      if (!a) return { ok: false };
      a.status = 'resolved';
      a.resolvedAt = new Date().toISOString();
      return { ok: true };
    }
  );
};

export default alertsRoutes;
TS
echo "[ok] alerts route written"

###############################################################################
# 3) Register alerts route ONCE in app.ts (safe, idempotent)
###############################################################################
echo
echo "[3/6] Registering alerts route in ${APP} (idempotent)"

# Ensure import exists
if ! grep -q "from './routes/alerts.js'" "${APP}"; then
  # Put import near top: after the fastify import if present; otherwise at top.
  if grep -q "^import fastify from" "${APP}"; then
    run sed -i "/^import fastify from/a import alertsRoutes from '.\\/routes\\/alerts.js';" "${APP}"
  else
    # Prepend import at file start
    tmp2="$(mktemp)"
    {
      echo "import alertsRoutes from './routes/alerts.js';"
      cat "${APP}"
    } > "${tmp2}"
    run mv "${tmp2}" "${APP}"
  fi
  echo "[ok] added import alertsRoutes"
else
  echo "[skip] import alertsRoutes already present"
fi

# Ensure registration exists exactly once
if ! grep -q "app.register(alertsRoutes)" "${APP}"; then
  # Register right after first app.register(newRoutes); if possible, else after /ready route.
  if grep -q "app.register(newRoutes);" "${APP}"; then
    run sed -i "/app\\.register(newRoutes);/a app.register(alertsRoutes);" "${APP}"
    echo "[ok] added app.register(alertsRoutes) after newRoutes"
  else
    run sed -i "/app\\.get(\"\\/ready\"/a app.register(alertsRoutes);" "${APP}" || true
    echo "[ok] added app.register(alertsRoutes) near /ready"
  fi
else
  echo "[skip] app.register(alertsRoutes) already present"
fi

###############################################################################
# 4) Add front-end sandbox (isolated, no App.tsx changes)
###############################################################################
echo
echo "[4/6] Creating front-end sandbox under webapp/sandbox"

run cd "${ROOT}/webapp"
run mkdir -p sandbox

cat > sandbox/index.html <<'HTML'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>APGMS Dev Sandbox</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/sandbox/main.tsx"></script>
  </body>
</html>
HTML

cat > sandbox/api.ts <<'TS'
const BASE = 'http://127.0.0.1:3000';

async function j<T>(p: Promise<Response>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json() as Promise<T>;
}

export const api = {
  ready: () => j(fetch(`${BASE}/ready`)),
  basPreview: () => j(fetch(`${BASE}/bas/preview`)),
  alerts: (status?: 'open' | 'resolved') =>
    j(fetch(`${BASE}/alerts${status ? `?status=${status}` : ''}`)),
  resolveAlert: (id: string) =>
    j(fetch(`${BASE}/alerts/${encodeURIComponent(id)}/resolve`, { method: 'POST' })),
  designated: () => j(fetch(`${BASE}/designated-accounts`)),
  evidenceCreate: () =>
    j(fetch(`${BASE}/compliance/evidence/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'ad-hoc' }),
    })),
  evidenceList: () => j(fetch(`${BASE}/compliance/evidence`)),
};
TS

cat > sandbox/main.tsx <<'TSX'
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api';

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: '1px solid #ccc', padding: 12, marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {children}
    </section>
  );
}

function App() {
  const [ready, setReady] = useState<any>();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<any>();
  const [err, setErr] = useState<string>();

  const load = async () => {
    try {
      setErr(undefined);
      const r = await api.ready();
      const a = await api.alerts('open');
      const e = await api.evidenceList();
      setReady(r);
      setAlerts(a);
      setEvidence(e);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
  };

  useEffect(() => { void load(); }, []);

  const resolve = async (id: string) => {
    try {
      await api.resolveAlert(id);
      await load();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
  };

  const createEvidence = async () => {
    try {
      await api.evidenceCreate();
      await load();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 1000, margin: '0 auto' }}>
      <h1>APGMS Dev Sandbox</h1>
      <p>API base: <code>http://127.0.0.1:3000</code></p>

      {err && (
        <div style={{ border: '1px solid #f99', padding: 12, marginBottom: 16 }}>
          <strong>Error</strong>
          <pre style={{ margin: 0 }}>{err}</pre>
        </div>
      )}

      <Box title="/ready">
        <pre>{JSON.stringify(ready, null, 2)}</pre>
      </Box>

      <Box title="Alerts (open)">
        {alerts.length === 0 ? (
          <div>No open alerts.</div>
        ) : (
          <ul>
            {alerts.map(a => (
              <li key={a.id}>
                <strong>{a.title}</strong> [{a.severity}] ({a.status})
                <button style={{ marginLeft: 8 }} onClick={() => resolve(a.id)}>Resolve</button>
              </li>
            ))}
          </ul>
        )}
      </Box>

      <Box title="Evidence">
        <button onClick={createEvidence}>Create Evidence</button>
        <pre>{JSON.stringify(evidence, null, 2)}</pre>
      </Box>

      <Box title="Reload">
        <button onClick={() => void load()}>Reload all</button>
      </Box>
    </div>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />);
TSX

echo "[ok] webapp sandbox written"

###############################################################################
# 5) Typecheck
###############################################################################
echo
echo "[5/6] Running typecheck"
run cd "${ROOT}"
run pnpm -r typecheck

###############################################################################
# 6) Print run instructions
###############################################################################
echo
echo "[6/6] DONE"
echo "[log] ${LOG_FILE}"
echo
echo "Next run commands:"
echo "  cd ~/src/APGMS"
echo "  ./scripts/dev-api-stop.sh"
echo "  DEV_READY_ALWAYS=1 pnpm --filter @apgms/api-gateway dev &"
echo "  pnpm --filter apgms-webapp dev -- --port 5173 --strictPort"
echo
echo "Open:"
echo "  http://localhost:5173/sandbox/index.html"
