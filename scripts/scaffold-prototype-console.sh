#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(pwd)"
WEBAPP_DIR="$REPO_ROOT/webapp"

if [[ ! -d "$WEBAPP_DIR/src" ]]; then
  echo "ERROR: webapp/src not found. Run from repo root (~/src/APGMS)." >&2
  exit 1
fi

echo "== Scaffold: Admin-gated Prototype Console (Demo Mode) =="

# Clean only areas we fully manage (prevents broken imports / half-written files)
rm -rf \
  "$WEBAPP_DIR/src/auth" \
  "$WEBAPP_DIR/src/admin" \
  "$WEBAPP_DIR/src/prototype" \
  "$WEBAPP_DIR/src/pages"

mkdir -p \
  "$WEBAPP_DIR/src/auth" \
  "$WEBAPP_DIR/src/admin" \
  "$WEBAPP_DIR/src/pages" \
  "$WEBAPP_DIR/src/prototype" \
  "$WEBAPP_DIR/src/prototype/pages" \
  "$WEBAPP_DIR/src/prototype/components"

# ----------------------------
# AuthContext (fixes main.tsx import error)
# ----------------------------
cat > "$WEBAPP_DIR/src/auth/AuthContext.tsx" <<'TSX'
import React, { createContext, useContext, useMemo, useState } from "react";

export type UserRole = "admin" | "user";

export type AuthUser = {
  name: string;
  role: UserRole;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAdmin: boolean;
  login: (u: AuthUser) => void;
  logout: () => void;
};

const STORAGE_KEY = "apgms_auth_v1";
const AuthContext = createContext<AuthContextValue | null>(null);

function safeReadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed || typeof parsed.name !== "string" || (parsed.role !== "admin" && parsed.role !== "user")) return null;
    return parsed;
  } catch {
    return null;
  }
}

function safeWriteUser(u: AuthUser | null) {
  try {
    if (!u) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  } catch {
    // ignore
  }
}

export function AuthProvider(props: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => safeReadUser());

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      isAdmin: user?.role === "admin",
      login: (u: AuthUser) => {
        setUser(u);
        safeWriteUser(u);
      },
      logout: () => {
        setUser(null);
        safeWriteUser(null);
      },
    };
  }, [user]);

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
TSX

# ----------------------------
# main.tsx (ensure it imports AuthProvider from ./auth/AuthContext)
# ----------------------------
cat > "$WEBAPP_DIR/src/main.tsx" <<'TSX'
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import App from "./App";
import "./ui/ui.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
TSX

# ----------------------------
# Login page (local demo auth)
# ----------------------------
cat > "$WEBAPP_DIR/src/pages/LoginPage.tsx" <<'TSX'
import React, { useMemo, useState } from "react";
import { useAuth, type UserRole } from "../auth/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const [name, setName] = useState("Matthew");
  const canLogin = useMemo(() => name.trim().length >= 2, [name]);

  const doLogin = (role: UserRole) => {
    if (!canLogin) return;
    login({ name: name.trim(), role });
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "min(720px, 100%)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, opacity: 0.8 }}>APGMS</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>Sign in</div>
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, textAlign: "right" }}>
            Demo auth (local only)
            <div style={{ marginTop: 2 }}>Admin-gated console at /proto/*</div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Display name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            style={{
              width: "100%",
              marginTop: 6,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.2)",
              color: "inherit",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <button
            onClick={() => doLogin("user")}
            disabled={!canLogin}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit",
              cursor: canLogin ? "pointer" : "not-allowed",
            }}
          >
            Sign in as User
          </button>

          <button
            onClick={() => doLogin("admin")}
            disabled={!canLogin}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.10)",
              color: "inherit",
              cursor: canLogin ? "pointer" : "not-allowed",
              fontWeight: 700,
            }}
          >
            Sign in as Admin
          </button>
        </div>

        <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7, lineHeight: 1.4 }}>
          Admin can open the production-like console (mocked data, deterministic simulation, evidence packs).
          Users cannot see the console entry button and cannot access /proto/*.
        </div>
      </div>
    </div>
  );
}
TSX

# ----------------------------
# AdminArea (button shown only when isAdmin)
# ----------------------------
cat > "$WEBAPP_DIR/src/admin/AdminArea.tsx" <<'TSX'
import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function AdminArea() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <Link
        to="/proto/dashboard"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.12)",
          textDecoration: "none",
          color: "inherit",
          background: "rgba(255,255,255,0.08)",
          fontWeight: 700,
        }}
      >
        Open APGMS Console (Demo Mode)
      </Link>
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
        Prototype console is admin-only and uses deterministic mocked data with periodic incoming feed simulation.
      </div>
    </div>
  );
}
TSX

# ----------------------------
# App.tsx (routes: /proto/* + normal app)
# ----------------------------
cat > "$WEBAPP_DIR/src/App.tsx" <<'TSX'
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppMain from "./AppMain";
import { PrototypeApp } from "./prototype/PrototypeApp";

export default function App() {
  return (
    <Routes>
      <Route path="/proto/*" element={<PrototypeApp />} />
      <Route path="/*" element={<AppMain />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
TSX

# ----------------------------
# AppMain.tsx (simple production shell placeholder + admin button)
# ----------------------------
cat > "$WEBAPP_DIR/src/AppMain.tsx" <<'TSX'
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import LoginPage from "./pages/LoginPage";
import { AdminArea } from "./admin/AdminArea";

function Shell(props: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div style={{ minHeight: "100vh", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>APGMS</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>Home</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Signed in as <span style={{ fontWeight: 700 }}>{user?.name}</span> ({user?.role})
          </div>
          <button
            onClick={logout}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 16 }}>
        <div style={{ fontSize: 14, opacity: 0.85, lineHeight: 1.5 }}>
          {"APGMS is a control-plane and evidence system for tax obligations: it ingests transaction feeds, enforces funding and reconciliation controls, orchestrates lodgment and payment steps, and produces regulator-grade evidence packs."}
        </div>

        <AdminArea />

        <div style={{ marginTop: 16, fontSize: 12, opacity: 0.7 }}>
          This page is intentionally minimal. The production-like UX is in the admin-gated console.
        </div>
      </div>
    </div>
  );
}

export default function AppMain() {
  const { user } = useAuth();
  if (!user) return <LoginPage />;

  // If a non-admin tries /proto directly, they are blocked inside PrototypeApp.
  // AppMain stays as normal app root.
  if (window.location.pathname.startsWith("/proto")) {
    return <Navigate to="/" replace />;
  }

  return <Shell>OK</Shell>;
}
TSX

# ----------------------------
# Prototype CSS
# ----------------------------
cat > "$WEBAPP_DIR/src/prototype/prototype.css" <<'CSS'
.apgms-proto {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 280px 1fr;
}

.apgms-proto__sidebar {
  border-right: 1px solid rgba(255,255,255,0.12);
  padding: 16px;
}

.apgms-proto__brand {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.apgms-proto__title {
  font-size: 14px;
  opacity: 0.75;
}

.apgms-proto__subtitle {
  font-size: 16px;
  font-weight: 800;
  margin-top: 6px;
}

.apgms-proto__badge {
  font-size: 11px;
  padding: 6px 8px;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
}

.apgms-proto__nav {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.apgms-proto__nav a {
  padding: 10px 10px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.10);
  text-decoration: none;
  color: inherit;
  background: rgba(255,255,255,0.04);
  font-size: 13px;
}

.apgms-proto__nav a.active {
  background: rgba(255,255,255,0.10);
  border-color: rgba(255,255,255,0.18);
  font-weight: 700;
}

.apgms-proto__main {
  padding: 16px 18px 28px 18px;
}

.apgms-proto__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 16px;
  padding: 12px 12px;
}

.apgms-proto__topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.apgms-proto__topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.apgms-proto__btn {
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06);
  color: inherit;
  cursor: pointer;
  font-size: 12px;
}

.apgms-proto__btn--primary {
  background: rgba(255,255,255,0.12);
  font-weight: 700;
}

.apgms-proto__input {
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(0,0,0,0.18);
  color: inherit;
  font-size: 12px;
}

.apgms-proto__section {
  margin-top: 14px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 16px;
  padding: 14px;
}

.apgms-proto__h1 {
  font-size: 18px;
  font-weight: 900;
}

.apgms-proto__muted {
  opacity: 0.75;
  font-size: 12px;
  line-height: 1.4;
}

.apgms-proto__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 1fr));
  gap: 10px;
  margin-top: 12px;
}

@media (max-width: 1100px) {
  .apgms-proto { grid-template-columns: 1fr; }
  .apgms-proto__sidebar { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.12); }
  .apgms-proto__grid { grid-template-columns: repeat(2, minmax(160px, 1fr)); }
}

.apgms-proto__table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
  font-size: 12px;
}

.apgms-proto__table th,
.apgms-proto__table td {
  padding: 10px 8px;
  border-top: 1px solid rgba(255,255,255,0.10);
  text-align: left;
  vertical-align: top;
}

.apgms-proto__pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.06);
  font-size: 11px;
  white-space: nowrap;
}
CSS

# ----------------------------
# Prototype: deterministic RNG + mock data
# ----------------------------
cat > "$WEBAPP_DIR/src/prototype/mockData.ts" <<'TS'
export type PeriodKey = "2025-Q1" | "2025-Q2" | "2025-Q3" | "2025-Q4";

export type TaxType = "PAYGW" | "GST" | "PAYGI" | "SUPER";

export type ObligationStatus =
  | "funded"
  | "reconcile_pending"
  | "ready_to_lodge"
  | "lodged"
  | "paid"
  | "evidence_ready"
  | "overdue_risk";

export type DemoEventType =
  | "FEED_RECEIVED"
  | "LEDGER_POSTED"
  | "RECONCILE_SUGGESTION"
  | "RECONCILE_CLEARED"
  | "LODGMENT_PREPARED"
  | "LODGMENT_SUBMITTED"
  | "PAYMENT_SCHEDULED"
  | "EVIDENCE_PACK_GENERATED"
  | "POLICY_UPDATED"
  | "INCIDENT_CREATED"
  | "INCIDENT_UPDATED"
  | "SETTINGS_UPDATED"
  | "DEMO_RESET";

export type DemoEvent = {
  id: string;
  ts: number;
  type: DemoEventType;
  period: PeriodKey;
  message: string;
  meta?: Record<string, string>;
};

export type Obligation = {
  id: string;
  period: PeriodKey;
  taxType: TaxType;
  label: string;
  dueDate: string; // ISO date
  amountCents: number;
  status: ObligationStatus;
  blockers: string[];
};

export type BankLine = {
  id: string;
  ts: number;
  period: PeriodKey;
  amountCents: number;
  description: string;
  status: "matched" | "unmatched" | "suggested";
  suggestedObligationId?: string;
  resolvedAs?: "business" | "tax" | "excluded";
};

export type LedgerEntry = {
  id: string;
  ts: number;
  period: PeriodKey;
  obligationId?: string;
  account: "operating" | "tax_buffer" | "clearing";
  direction: "debit" | "credit";
  amountCents: number;
  source: "bank_feed" | "reconciliation" | "lodgment" | "payment" | "adjustment";
  memo: string;
};

export type EvidencePack = {
  id: string;
  ts: number;
  period: PeriodKey;
  obligationId: string;
  title: string;
  manifestHash: string; // demo hash
  items: {
    name: string;
    note: string;
  }[];
  diffNote: string;
};

export type Incident = {
  id: string;
  ts: number;
  severity: "low" | "medium" | "high";
  status: "open" | "mitigating" | "closed";
  title: string;
  description: string;
  period: PeriodKey;
  obligationIds: string[];
};

export type SettingsModel = {
  organization: {
    name: string;
    abn: string;
    timeZone: string;
    reportingCalendar: "standard" | "custom";
  };
  periods: {
    cadence: "monthly" | "quarterly";
    reminderDaysBeforeDue: number;
    dueDateRule: "standard" | "custom";
  };
  accounts: {
    operatingAccountLabel: string;
    taxBufferAccountLabel: string;
    segregatedAccountEnabled: boolean;
  };
  integrations: {
    bankFeed: "not_connected" | "connected_demo";
    accounting: "not_connected" | "connected_demo";
    payroll: "not_connected" | "connected_demo";
  };
  notifications: {
    emailEnabled: boolean;
    webhookEnabled: boolean;
  };
  security: {
    mfaRequiredForAdmin: boolean;
    sessionTimeoutMinutes: number;
    adminRoleNames: string[];
  };
  retention: {
    eventRetentionDays: number;
    evidencePackRetentionDays: number;
  };
  export: {
    defaultEvidencePackScope: "period" | "obligation";
    regulatorPortalEnabled: boolean;
  };
  simulation: {
    enabled: boolean;
    feedIntervalSeconds: number; // less often by default
    seed: string;
  };
};

export function formatMoney(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = (abs / 100).toFixed(2);
  const sign = cents < 0 ? "-" : "";
  return sign + "$" + dollars;
}

export function nowIso(ts: number): string {
  return new Date(ts).toISOString();
}

export function id(prefix: string, ts: number, n: number): string {
  return prefix + "_" + ts.toString(36) + "_" + n.toString(36);
}

// Deterministic PRNG (mulberry32) seeded from a string
function seedToUint32(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

export function makeRng(seed: string) {
  let a = seedToUint32(seed);
  return function rand(): number {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rand: () => number, items: T[]): T {
  return items[Math.floor(rand() * items.length)];
}

export function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(n)));
}
TS

# ----------------------------
# Prototype store (state + simulation + actions)
# ----------------------------
cat > "$WEBAPP_DIR/src/prototype/store.tsx" <<'TSX'
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type {
  BankLine,
  DemoEvent,
  EvidencePack,
  Incident,
  LedgerEntry,
  Obligation,
  PeriodKey,
  SettingsModel,
  TaxType,
} from "./mockData";
import { clampInt, formatMoney, id, makeRng, nowIso, pick } from "./mockData";

type DemoState = {
  period: PeriodKey;
  events: DemoEvent[];
  obligations: Obligation[];
  bankLines: BankLine[];
  ledger: LedgerEntry[];
  evidencePacks: EvidencePack[];
  incidents: Incident[];
  settings: SettingsModel;
};

type DemoActions = {
  setPeriod: (p: PeriodKey) => void;
  toggleSimulation: (enabled: boolean) => void;
  resetDemoState: () => void;

  runReconciliation: (obligationId: string) => void;
  resolveBankLine: (bankLineId: string, resolvedAs: "business" | "tax" | "excluded") => void;

  prepareLodgment: (obligationId: string) => void;
  submitLodgment: (obligationId: string) => void;
  generateEvidencePack: (obligationId: string) => void;

  updatePolicy: (key: string, value: string) => void;
  createIncident: (payload: { title: string; severity: "low" | "medium" | "high"; description: string; obligationIds: string[] }) => void;
  updateSettings: (patch: Partial<SettingsModel>) => void;
};

type DemoStore = DemoState & DemoActions;

const STORAGE_KEY = "apgms_demo_state_v1";
const DemoContext = createContext<DemoStore | null>(null);

function defaultSettings(): SettingsModel {
  return {
    organization: {
      name: "Demo Organization Pty Ltd",
      abn: "12 345 678 901",
      timeZone: "Australia/Brisbane",
      reportingCalendar: "standard",
    },
    periods: {
      cadence: "quarterly",
      reminderDaysBeforeDue: 14,
      dueDateRule: "standard",
    },
    accounts: {
      operatingAccountLabel: "Operating Account",
      taxBufferAccountLabel: "Tax Buffer (One-Way)",
      segregatedAccountEnabled: true,
    },
    integrations: {
      bankFeed: "connected_demo",
      accounting: "not_connected",
      payroll: "not_connected",
    },
    notifications: {
      emailEnabled: true,
      webhookEnabled: false,
    },
    security: {
      mfaRequiredForAdmin: true,
      sessionTimeoutMinutes: 30,
      adminRoleNames: ["Admin", "Compliance Admin"],
    },
    retention: {
      eventRetentionDays: 365,
      evidencePackRetentionDays: 3650,
    },
    export: {
      defaultEvidencePackScope: "obligation",
      regulatorPortalEnabled: true,
    },
    simulation: {
      enabled: false,
      feedIntervalSeconds: 45, // less often by default
      seed: "apgms-demo-seed-001",
    },
  };
}

function initialObligations(period: PeriodKey): Obligation[] {
  const common = (taxType: TaxType, label: string, dueDate: string, amountCents: number, status: Obligation["status"]): Obligation => ({
    id: taxType + "_" + period,
    period,
    taxType,
    label,
    dueDate,
    amountCents,
    status,
    blockers: status === "reconcile_pending" ? ["Reconciliation not cleared"] : status === "overdue_risk" ? ["Approaching due date: verify inputs"] : [],
  });

  // Demo baseline by period
  return [
    common("GST", "BAS " + period, "2025-04-28", 1245500, "reconcile_pending"),
    common("PAYGW", "PAYG Withholding " + period, "2025-04-21", 845300, "funded"),
    common("PAYGI", "PAYG Instalment " + period, "2025-04-28", 312400, "ready_to_lodge"),
    common("SUPER", "Super Guarantee " + period, "2025-04-28", 510000, "funded"),
  ];
}

function freshState(): DemoState {
  const period: PeriodKey = "2025-Q1";
  const ts = Date.now();
  return {
    period,
    events: [
      {
        id: id("evt", ts, 1),
        ts,
        type: "LEDGER_POSTED",
        period,
        message: "Demo state initialized (" + nowIso(ts) + ")",
      },
    ],
    obligations: initialObligations(period),
    bankLines: [],
    ledger: [],
    evidencePacks: [],
    incidents: [],
    settings: defaultSettings(),
  };
}

function safeReadState(): DemoState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoState;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function safeWriteState(s: DemoState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

function limitEvents(events: DemoEvent[], max: number): DemoEvent[] {
  if (events.length <= max) return events;
  return events.slice(events.length - max);
}

export function DemoStoreProvider(props: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoState>(() => safeReadState() ?? freshState());

  // Persist
  useEffect(() => {
    safeWriteState(state);
  }, [state]);

  // Simulation timer
  const timerRef = useRef<number | null>(null);

  const stopTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = (intervalSeconds: number) => {
    stopTimer();
    const ms = clampInt(intervalSeconds, 10, 600) * 1000;
    timerRef.current = window.setInterval(() => {
      setState((prev) => tick(prev));
    }, ms);
  };

  useEffect(() => {
    if (state.settings.simulation.enabled) startTimer(state.settings.simulation.feedIntervalSeconds);
    else stopTimer();
    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.settings.simulation.enabled, state.settings.simulation.feedIntervalSeconds]);

  const addEvent = (prev: DemoState, e: DemoEvent): DemoState => {
    return { ...prev, events: limitEvents([...prev.events, e], 200) };
  };

  const setPeriod = (p: PeriodKey) => {
    setState((prev) => {
      const ts = Date.now();
      const next: DemoState = {
        ...prev,
        period: p,
        obligations: initialObligations(p),
      };
      return addEvent(next, {
        id: id("evt", ts, 2),
        ts,
        type: "SETTINGS_UPDATED",
        period: p,
        message: "Period switched to " + p,
      });
    });
  };

  const updateSettings = (patch: Partial<SettingsModel>) => {
    setState((prev) => {
      const ts = Date.now();
      const next: DemoState = {
        ...prev,
        settings: { ...prev.settings, ...patch, simulation: { ...prev.settings.simulation, ...(patch.simulation ?? {}) } },
      };
      return addEvent(next, {
        id: id("evt", ts, 3),
        ts,
        type: "SETTINGS_UPDATED",
        period: prev.period,
        message: "Settings updated",
      });
    });
  };

  const toggleSimulation = (enabled: boolean) => {
    updateSettings({ simulation: { ...state.settings.simulation, enabled } });
  };

  const resetDemoState = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    const s = freshState();
    const ts = Date.now();
    s.events = limitEvents(
      [
        ...s.events,
        { id: id("evt", ts, 99), ts, type: "DEMO_RESET", period: s.period, message: "Demo state reset" },
      ],
      200
    );
    setState(s);
  };

  const tick = (prev: DemoState): DemoState => {
    const ts = Date.now();
    const rand = makeRng(prev.settings.simulation.seed + "|" + Math.floor(ts / 1000).toString());

    const newLineId = id("bank", ts, clampInt(rand() * 1000, 1, 999));
    const amountCents = clampInt(rand() * 950000 + 2500, 2500, 975000);
    const desc = pick(rand, [
      "BANK FEED: Settlement",
      "BANK FEED: Merchant deposit",
      "BANK FEED: Payroll clearing",
      "BANK FEED: Transfer (buffer)",
      "BANK FEED: Adjustment",
    ]);

    // Occasionally create unmatched lines so you can demo controls/incidents
    const isUnmatched = rand() < 0.22;

    const candidateObligations = prev.obligations;
    const suggested = pick(rand, candidateObligations);

    const bankLine: BankLine = {
      id: newLineId,
      ts,
      period: prev.period,
      amountCents,
      description: desc,
      status: isUnmatched ? "unmatched" : "suggested",
      suggestedObligationId: isUnmatched ? undefined : suggested.id,
    };

    let next = { ...prev, bankLines: [bankLine, ...prev.bankLines].slice(0, 100) };

    next = addEvent(next, {
      id: id("evt", ts, 10),
      ts,
      type: "FEED_RECEIVED",
      period: prev.period,
      message: "Bank feed received (" + formatMoney(amountCents) + "): " + desc,
    });

    // Post ledger from feed
    const ledgerEntry: LedgerEntry = {
      id: id("led", ts, 11),
      ts,
      period: prev.period,
      obligationId: bankLine.suggestedObligationId,
      account: "operating",
      direction: "credit",
      amountCents,
      source: "bank_feed",
      memo: "Auto-posted from bank feed line " + bankLine.id,
    };
    next = { ...next, ledger: [ledgerEntry, ...next.ledger].slice(0, 200) };

    next = addEvent(next, {
      id: id("evt", ts, 12),
      ts,
      type: "LEDGER_POSTED",
      period: prev.period,
      message: "Ledger posted from bank feed (" + formatMoney(amountCents) + ")",
      meta: { bankLineId: bankLine.id },
    });

    // Create reconcile suggestion
    next = addEvent(next, {
      id: id("evt", ts, 13),
      ts,
      type: "RECONCILE_SUGGESTION",
      period: prev.period,
      message: isUnmatched
        ? "Reconciliation exception created (unmatched bank line)"
        : "Match suggestion created for " + (suggested.taxType + " " + prev.period),
      meta: isUnmatched ? { bankLineId: bankLine.id } : { bankLineId: bankLine.id, obligationId: suggested.id },
    });

    // Occasionally raise a low-severity incident if multiple unmatched exist
    const unmatched = next.bankLines.filter((b) => b.status === "unmatched").length;
    if (unmatched >= 3 && rand() < 0.25) {
      const incId = id("inc", ts, 14);
      const inc: Incident = {
        id: incId,
        ts,
        severity: "low",
        status: "open",
        title: "Reconciliation exceptions accumulating",
        description: "Multiple unmatched feed lines detected. Review and resolve to unblock lodgment controls.",
        period: prev.period,
        obligationIds: [],
      };
      next = { ...next, incidents: [inc, ...next.incidents].slice(0, 50) };
      next = addEvent(next, {
        id: id("evt", ts, 15),
        ts,
        type: "INCIDENT_CREATED",
        period: prev.period,
        message: "Incident created: " + inc.title,
        meta: { incidentId: incId },
      });
    }

    return next;
  };

  const runReconciliation = (obligationId: string) => {
    setState((prev) => {
      const ts = Date.now();
      const obs = prev.obligations.map((o) => {
        if (o.id !== obligationId) return o;
        const blockers = prev.bankLines.some((b) => b.status === "unmatched") ? ["Unmatched bank lines exist"] : [];
        const status = blockers.length ? "reconcile_pending" : "ready_to_lodge";
        return { ...o, blockers, status };
      });
      let next: DemoState = { ...prev, obligations: obs };

      next = addEvent(next, {
        id: id("evt", ts, 20),
        ts,
        type: "RECONCILE_CLEARED",
        period: prev.period,
        message: "Reconciliation run for obligation " + obligationId,
        meta: { obligationId },
      });

      // Ledger entry for reconciliation
      const le: LedgerEntry = {
        id: id("led", ts, 21),
        ts,
        period: prev.period,
        obligationId,
        account: "clearing",
        direction: "debit",
        amountCents: 2500,
        source: "reconciliation",
        memo: "Reconciliation run (demo)",
      };
      next = { ...next, ledger: [le, ...next.ledger].slice(0, 200) };

      return next;
    });
  };

  const resolveBankLine = (bankLineId: string, resolvedAs: "business" | "tax" | "excluded") => {
    setState((prev) => {
      const ts = Date.now();
      const lines = prev.bankLines.map((b) => {
        if (b.id !== bankLineId) return b;
        return { ...b, status: "matched", resolvedAs };
      });

      let next: DemoState = { ...prev, bankLines: lines };
      next = addEvent(next, {
        id: id("evt", ts, 30),
        ts,
        type: "RECONCILE_CLEARED",
        period: prev.period,
        message: "Bank line resolved: " + bankLineId + " as " + resolvedAs,
        meta: { bankLineId, resolvedAs },
      });
      return next;
    });
  };

  const prepareLodgment = (obligationId: string) => {
    setState((prev) => {
      const ts = Date.now();
      const obs = prev.obligations.map((o) => (o.id === obligationId ? { ...o } : o));
      let next: DemoState = { ...prev, obligations: obs };
      next = addEvent(next, {
        id: id("evt", ts, 40),
        ts,
        type: "LODGMENT_PREPARED",
        period: prev.period,
        message: "Lodgment payload prepared (demo) for " + obligationId,
        meta: { obligationId },
      });
      return next;
    });
  };

  const submitLodgment = (obligationId: string) => {
    setState((prev) => {
      const ts = Date.now();
      const obs = prev.obligations.map((o) => {
        if (o.id !== obligationId) return o;
        const blockers = o.blockers.length ? o.blockers : [];
        if (blockers.length) return { ...o };
        return { ...o, status: "lodged" };
      });

      let next: DemoState = { ...prev, obligations: obs };
      next = addEvent(next, {
        id: id("evt", ts, 50),
        ts,
        type: "LODGMENT_SUBMITTED",
        period: prev.period,
        message: "Lodgment submitted (demo) for " + obligationId,
        meta: { obligationId },
      });

      const le: LedgerEntry = {
        id: id("led", ts, 51),
        ts,
        period: prev.period,
        obligationId,
        account: "tax_buffer",
        direction: "debit",
        amountCents: 10000,
        source: "lodgment",
        memo: "Lodgment posted (demo)",
      };
      next = { ...next, ledger: [le, ...next.ledger].slice(0, 200) };

      return next;
    });
  };

  const generateEvidencePack = (obligationId: string) => {
    setState((prev) => {
      const ts = Date.now();
      const packId = id("pack", ts, 60);
      const hash = "demo_" + packId.slice(0, 10);

      const pack: EvidencePack = {
        id: packId,
        ts,
        period: prev.period,
        obligationId,
        title: "Evidence Pack - " + obligationId + " - " + prev.period,
        manifestHash: hash,
        items: [
          { name: "manifest.json", note: "Hashes + file list (demo)" },
          { name: "timeline.json", note: "Event timeline snapshot (demo)" },
          { name: "lodgment.json", note: "Lodgment payload snapshot (demo)" },
          { name: "reconciliation.json", note: "Reconciliation summary (demo)" },
          { name: "controls.json", note: "Controls + attestation snapshot (demo)" },
        ],
        diffNote: "Demo diff: prior pack baseline vs current pack (mocked).",
      };

      let next: DemoState = { ...prev, evidencePacks: [pack, ...prev.evidencePacks].slice(0, 50) };
      next = addEvent(next, {
        id: id("evt", ts, 61),
        ts,
        type: "EVIDENCE_PACK_GENERATED",
        period: prev.period,
        message: "Evidence pack generated for " + obligationId,
        meta: { obligationId, evidencePackId: packId },
      });

      const obs = next.obligations.map((o) => (o.id === obligationId ? { ...o, status: "evidence_ready" } : o));
      next = { ...next, obligations: obs };

      return next;
    });
  };

  const updatePolicy = (key: string, value: string) => {
    setState((prev) => {
      const ts = Date.now();
      let next: DemoState = { ...prev };
      next = addEvent(next, {
        id: id("evt", ts, 70),
        ts,
        type: "POLICY_UPDATED",
        period: prev.period,
        message: "Policy updated: " + key + " = " + value,
        meta: { key, value },
      });
      return next;
    });
  };

  const createIncident = (payload: { title: string; severity: "low" | "medium" | "high"; description: string; obligationIds: string[] }) => {
    setState((prev) => {
      const ts = Date.now();
      const incId = id("inc", ts, 80);
      const inc: Incident = {
        id: incId,
        ts,
        severity: payload.severity,
        status: "open",
        title: payload.title,
        description: payload.description,
        period: prev.period,
        obligationIds: payload.obligationIds,
      };
      let next: DemoState = { ...prev, incidents: [inc, ...prev.incidents].slice(0, 50) };
      next = addEvent(next, {
        id: id("evt", ts, 81),
        ts,
        type: "INCIDENT_CREATED",
        period: prev.period,
        message: "Incident created: " + payload.title,
        meta: { incidentId: incId },
      });
      return next;
    });
  };

  const value: DemoStore = useMemo(() => {
    return {
      ...state,
      setPeriod,
      toggleSimulation,
      resetDemoState,
      runReconciliation,
      resolveBankLine,
      prepareLodgment,
      submitLodgment,
      generateEvidencePack,
      updatePolicy,
      createIncident,
      updateSettings,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return <DemoContext.Provider value={value}>{props.children}</DemoContext.Provider>;
}

export function useDemoStore() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemoStore must be used within DemoStoreProvider");
  return ctx;
}
TSX

# ----------------------------
# Prototype components
# ----------------------------
cat > "$WEBAPP_DIR/src/prototype/components/StatusPill.tsx" <<'TSX'
import React from "react";

export function StatusPill(props: { text: string }) {
  return <span className="apgms-proto__pill">{props.text}</span>;
}
TSX

cat > "$WEBAPP_DIR/src/prototype/components/StatTile.tsx" <<'TSX'
import React from "react";

export function StatTile(props: { title: string; value: string; note: string }) {
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{props.title}</div>
      <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6 }}>{props.value}</div>
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6, lineHeight: 1.35 }}>{props.note}</div>
    </div>
  );
}
TSX

cat > "$WEBAPP_DIR/src/prototype/components/KeyValueTable.tsx" <<'TSX'
import React from "react";

export function KeyValueTable(props: { rows: { k: string; v: React.ReactNode }[] }) {
  return (
    <table className="apgms-proto__table">
      <tbody>
        {props.rows.map((r) => (
          <tr key={r.k}>
            <th style={{ width: 260, opacity: 0.8, fontWeight: 700 }}>{r.k}</th>
            <td style={{ opacity: 0.9 }}>{r.v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
TSX

# ----------------------------
# Prototype pages
# ----------------------------
cat > "$WEBAPP_DIR/src/prototype/pages/DashboardPage.tsx" <<'TSX'
import React from "react";
import { useDemoStore } from "../store";
import { StatTile } from "../components/StatTile";
import { StatusPill } from "../components/StatusPill";

export default function DashboardPage() {
  const { period, obligations, events, settings } = useDemoStore();

  const funded = obligations.filter((o) => o.status === "funded").length;
  const reconcilePending = obligations.filter((o) => o.status === "reconcile_pending").length;
  const readyToLodge = obligations.filter((o) => o.status === "ready_to_lodge").length;
  const overdueRisk = obligations.filter((o) => o.status === "overdue_risk").length;

  return (
    <div className="apgms-proto__section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="apgms-proto__h1">Dashboard</div>
          <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
            {"Operational truth by period. All actions produce events that can be packaged into evidence."}
          </div>
        </div>
        <div>
          <StatusPill text={"Period: " + period} />
          <span style={{ marginLeft: 8 }} />
          <StatusPill text={"Simulation: " + (settings.simulation.enabled ? "ON" : "OFF")} />
          <span style={{ marginLeft: 8 }} />
          <StatusPill text={"Feed interval: " + settings.simulation.feedIntervalSeconds + "s"} />
        </div>
      </div>

      <div className="apgms-proto__grid">
        <StatTile title="Funded" value={String(funded)} note="Funding controls satisfied." />
        <StatTile title="Reconcile pending" value={String(reconcilePending)} note="Inputs not yet cleared." />
        <StatTile title="Ready to lodge" value={String(readyToLodge)} note="Controls satisfied, payload can be prepared." />
        <StatTile title="Overdue risk" value={String(overdueRisk)} note="Approaching due date or exception state." />
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>Recent activity</div>
        <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
          {"This is event-backed. Evidence packs include the event timeline + hashes (demo)."}
        </div>

        <table className="apgms-proto__table">
          <thead>
            <tr>
              <th style={{ width: 190 }}>Time</th>
              <th style={{ width: 180 }}>Type</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {events.slice(0, 12).map((e) => (
              <tr key={e.id}>
                <td style={{ opacity: 0.8 }}>{new Date(e.ts).toLocaleString()}</td>
                <td><StatusPill text={e.type} /></td>
                <td style={{ opacity: 0.9 }}>{e.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
TSX

cat > "$WEBAPP_DIR/src/prototype/pages/ObligationsPage.tsx" <<'TSX'
import React from "react";
import { Link } from "react-router-dom";
import { useDemoStore } from "../store";
import { formatMoney } from "../mockData";
import { StatusPill } from "../components/StatusPill";

export default function ObligationsPage() {
  const { obligations } = useDemoStore();

  return (
    <div className="apgms-proto__section">
      <div className="apgms-proto__h1">Obligations</div>
      <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
        {"Workflow engine view. Preconditions block lodgment and payment until inputs are reconciled and controlled."}
      </div>

      <table className="apgms-proto__table">
        <thead>
          <tr>
            <th style={{ width: 120 }}>Tax type</th>
            <th>Obligation</th>
            <th style={{ width: 140 }}>Due date</th>
            <th style={{ width: 140 }}>Amount</th>
            <th style={{ width: 160 }}>Status</th>
            <th style={{ width: 120 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {obligations.map((o) => (
            <tr key={o.id}>
              <td><StatusPill text={o.taxType} /></td>
              <td style={{ fontWeight: 700 }}>{o.label}</td>
              <td style={{ opacity: 0.8 }}>{o.dueDate}</td>
              <td style={{ opacity: 0.9 }}>{formatMoney(o.amountCents)}</td>
              <td><StatusPill text={o.status} /></td>
              <td>
                <Link to={"/proto/obligations/" + encodeURIComponent(o.id)} style={{ color: "inherit" }}>
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
TSX

cat > "$WEBAPP_DIR/src/prototype/pages/ObligationDetailPage.tsx" <<'TSX'
import React from "react";
import { Link, useParams } from "react-router-dom";
import { useDemoStore } from "../store";
import { formatMoney } from "../mockData";
import { StatusPill } from "../components/StatusPill";

export default function ObligationDetailPage() {
  const { obligationId } = useParams();
  const { obligations, runReconciliation, prepareLodgment, submitLodgment, generateEvidencePack } = useDemoStore();

  const ob = obligations.find((o) => o.id === obligationId);
  if (!ob) {
    return (
      <div className="apgms-proto__section">
        <div className="apgms-proto__h1">Obligation not found</div>
        <div className="apgms-proto__muted" style={{ marginTop: 8 }}>
          <Link to="/proto/obligations" style={{ color: "inherit" }}>Back to obligations</Link>
        </div>
      </div>
    );
  }

  const canLodge = ob.blockers.length === 0 && (ob.status === "ready_to_lodge" || ob.status === "lodged" || ob.status === "evidence_ready");
  const canEvidence = ob.status === "lodged" || ob.status === "evidence_ready";

  return (
    <div className="apgms-proto__section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="apgms-proto__h1">{ob.label}</div>
          <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
            {"Lifecycle: Fund, Reconcile, Lodge, Pay, Evidence Pack. Controls block the next step until preconditions are met."}
          </div>
        </div>
        <div>
          <Link to="/proto/obligations" style={{ color: "inherit" }}>Back</Link>
        </div>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <StatusPill text={ob.taxType} />
        <StatusPill text={"Due " + ob.dueDate} />
        <StatusPill text={"Amount " + formatMoney(ob.amountCents)} />
        <StatusPill text={"Status " + ob.status} />
      </div>

      {ob.blockers.length > 0 && (
        <div style={{ marginTop: 12, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 12 }}>
          <div style={{ fontWeight: 800 }}>Blockers</div>
          <ul style={{ marginTop: 8, opacity: 0.85, paddingLeft: 18 }}>
            {ob.blockers.map((b) => <li key={b}>{b}</li>)}
          </ul>
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="apgms-proto__btn apgms-proto__btn--primary" onClick={() => runReconciliation(ob.id)}>
          Run reconciliation
        </button>

        <button className="apgms-proto__btn" onClick={() => prepareLodgment(ob.id)} disabled={!canLodge}>
          Prepare lodgment (demo)
        </button>

        <button className="apgms-proto__btn" onClick={() => submitLodgment(ob.id)} disabled={!canLodge}>
          Submit lodgment (demo)
        </button>

        <button className="apgms-proto__btn" onClick={() => generateEvidencePack(ob.id)} disabled={!canEvidence}>
          Generate evidence pack
        </button>
      </div>

      <div style={{ marginTop: 14 }} className="apgms-proto__muted">
        {"Note: This demo keeps everything deterministic and event-backed. In production, these actions would be backed by connectors and signed evidence artifacts."}
      </div>
    </div>
  );
}
TSX

cat > "$WEBAPP_DIR/src/prototype/pages/LedgerPage.tsx" <<'TSX'
import React, { useMemo, useState } from "react";
import { useDemoStore } from "../store";
import { formatMoney } from "../mockData";
import { StatusPill } from "../components/StatusPill";

export default function LedgerPage() {
  const { ledger, obligations, period } = useDemoStore();
  const [filterOb, setFilterOb] = useState<string>("");

  const rows = useMemo(() => {
    const base = ledger.filter((l) => l.period === period);
    if (!filterOb) return base;
    return base.filter((l) => l.obligationId === filterOb);
  }, [ledger, period, filterOb]);

  return (
    <div className="apgms-proto__section">
      <div className="apgms-proto__h1">Ledger</div>
      <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
        {"Audit spine. Derived figures trace back to ledger entries and events."}
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <select className="apgms-proto__input" value={filterOb} onChange={(e) => setFilterOb(e.target.value)}>
          <option value="">All obligations</option>
          {obligations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.taxType + " - " + o.period}
            </option>
          ))}
        </select>

        <StatusPill text={"Rows: " + String(rows.length)} />
      </div>

      <table className="apgms-proto__table">
        <thead>
          <tr>
            <th style={{ width: 190 }}>Time</th>
            <th style={{ width: 120 }}>Account</th>
            <th style={{ width: 120 }}>Direction</th>
            <th style={{ width: 140 }}>Amount</th>
            <th style={{ width: 160 }}>Source</th>
            <th>Memo</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 80).map((l) => (
            <tr key={l.id}>
              <td style={{ opacity: 0.8 }}>{new Date(l.ts).toLocaleString()}</td>
              <td><StatusPill text={l.account} /></td>
              <td><StatusPill text={l.direction} /></td>
              <td style={{ opacity: 0.9 }}>{formatMoney(l.amountCents)}</td>
              <td style={{ opacity: 0.85 }}>{l.source}</td>
              <td style={{ opacity: 0.9 }}>{l.memo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
TSX

cat > "$WEBAPP_DIR/src/prototype/pages/ReconciliationPage.tsx" <<'TSX'
import React from "react";
import { useDemoStore } from "../store";
import { formatMoney } from "../mockData";
import { StatusPill } from "../components/StatusPill";

export default function ReconciliationPage() {
  const { bankLines, resolveBankLine } = useDemoStore();

  return (
    <div className="apgms-proto__section">
      <div className="apgms-proto__h1">Reconciliation</div>
      <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
        {"Control gate. Lodgment should not proceed on unverified inputs. Resolve exceptions and re-run reconciliation in the obligation view."}
      </div>

      <table className="apgms-proto__table">
        <thead>
          <tr>
            <th style={{ width: 190 }}>Time</th>
            <th>Description</th>
            <th style={{ width: 140 }}>Amount</th>
            <th style={{ width: 140 }}>Status</th>
            <th style={{ width: 240 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {bankLines.slice(0, 60).map((b) => (
            <tr key={b.id}>
              <td style={{ opacity: 0.8 }}>{new Date(b.ts).toLocaleString()}</td>
              <td style={{ opacity: 0.9 }}>
                {b.description}
                <div className="apgms-proto__muted" style={{ marginTop: 4 }}>Line ID: {b.id}</div>
              </td>
              <td style={{ opacity: 0.9 }}>{formatMoney(b.amountCents)}</td>
              <td><StatusPill text={b.status} /></td>
              <td>
                {b.status === "unmatched" ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="apgms-proto__btn" onClick={() => resolveBankLine(b.id, "business")}>Mark business</button>
                    <button className="apgms-proto__btn" onClick={() => resolveBankLine(b.id, "tax")}>Mark tax</button>
                    <button className="apgms-proto__btn" onClick={() => resolveBankLine(b.id, "excluded")}>Exclude</button>
                  </div>
                ) : (
                  <span className="apgms-proto__muted">No action required</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
TSX

cat > "$WEBAPP_DIR/src/prototype/pages/EvidencePackPage.tsx" <<'TSX'
import React, { useMemo, useState } from "react";
import { useDemoStore } from "../store";
import { StatusPill } from "../components/StatusPill";

export default function EvidencePackPage() {
  const { evidencePacks, obligations, period } = useDemoStore();
  const [selectedId, setSelectedId] = useState<string>("");

  const packs = useMemo(() => evidencePacks.filter((p) => p.period === period), [evidencePacks, period]);
  const selected = packs.find((p) => p.id === selectedId) ?? packs[0] ?? null;

  const obligationLabel = (id: string) => obligations.find((o) => o.id === id)?.label ?? id;

  return (
    <div className="apgms-proto__section">
      <div className="apgms-proto__h1">Evidence Pack</div>
      <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
        {"Regulator-grade artifact. Reproducible: same inputs, same outputs, same hashes (demo)."}
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <select className="apgms-proto__input" value={selected?.id ?? ""} onChange={(e) => setSelectedId(e.target.value)}>
          {packs.length === 0 ? <option value="">No packs yet</option> : null}
          {packs.map((p) => (
            <option key={p.id} value={p.id}>
              {new Date(p.ts).toLocaleString()} - {obligationLabel(p.obligationId)}
            </option>
          ))}
        </select>

        <StatusPill text={"Packs: " + String(packs.length)} />
      </div>

      {selected ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900 }}>{selected.title}</div>
          <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
            Manifest hash (demo): <span style={{ fontWeight: 800 }}>{selected.manifestHash}</span>
          </div>

          <table className="apgms-proto__table">
            <thead>
              <tr>
                <th style={{ width: 180 }}>File</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {selected.items.map((it) => (
                <tr key={it.name}>
                  <td><StatusPill text={it.name} /></td>
                  <td style={{ opacity: 0.9 }}>{it.note}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 12, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 12 }}>
            <div style={{ fontWeight: 900 }}>What changed since last pack</div>
            <div className="apgms-proto__muted" style={{ marginTop: 6 }}>{selected.diffNote}</div>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12 }} className="apgms-proto__muted">
          Generate a pack from an obligation to populate this view.
        </div>
      )}
    </div>
  );
}
TSX

cat > "$WEBAPP_DIR/src/prototype/pages/ControlsPoliciesPage.tsx" <<'TSX'
import React, { useState } from "react";
import { useDemoStore } from "../store";
import { StatusPill } from "../components/StatusPill";

export default function ControlsPoliciesPage() {
  const { settings, updatePolicy } = useDemoStore();
  const [fundingCadence, setFundingCadence] = useState("weekly");
  const [matchThreshold, setMatchThreshold] = useState("strict");
  const [adminOnlyActions, setAdminOnlyActions] = useState("enabled");

  const save = () => {
    updatePolicy("funding.cadence", fundingCadence);
    updatePolicy("reconciliation.matchThreshold", matchThreshold);
    updatePolicy("access.adminOnlyActions", adminOnlyActions);
  };

  return (
    <div className="apgms-proto__section">
      <div className="apgms-proto__h1">Controls & Policies</div>
      <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
        {"Controls are explicit and versioned. You can show which policy version was in force for any event (demo)."}
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(2, minmax(240px, 1fr))", gap: 12 }}>
        <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 12 }}>
          <div style={{ fontWeight: 900 }}>Funding policy</div>
          <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
            {"Buffer rules, allocation cadence, and blocking behavior for shortfalls (demo)."}
          </div>
          <div style={{ marginTop: 10 }}>
            <label className="apgms-proto__muted">Allocation cadence</label>
            <select className="apgms-proto__input" value={fundingCadence} onChange={(e) => setFundingCadence(e.target.value)} style={{ width: "100%", marginTop: 6 }}>
              <option value="per_payrun">Per pay run</option>
              <option value="weekly">Weekly</option>
              <option value="ramp_up">Ramp-up near due date</option>
            </select>
          </div>
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 12 }}>
          <div style={{ fontWeight: 900 }}>Reconciliation policy</div>
          <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
            {"Matching thresholds and blocking rules (demo)."}
          </div>
          <div style={{ marginTop: 10 }}>
            <label className="apgms-proto__muted">Match threshold</label>
            <select className="apgms-proto__input" value={matchThreshold} onChange={(e) => setMatchThreshold(e.target.value)} style={{ width: "100%", marginTop: 6 }}>
              <option value="strict">Strict</option>
              <option value="balanced">Balanced</option>
              <option value="permissive">Permissive</option>
            </select>
          </div>
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 12 }}>
          <div style={{ fontWeight: 900 }}>Access policy</div>
          <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
            {"Admin-only actions and least-privilege enforcement (demo)."}
          </div>
          <div style={{ marginTop: 10 }}>
            <label className="apgms-proto__muted">Admin-only actions</label>
            <select className="apgms-proto__input" value={adminOnlyActions} onChange={(e) => setAdminOnlyActions(e.target.value)} style={{ width: "100%", marginTop: 6 }}>
              <option value="enabled">Enabled</option>
              <option value="disabled_demo">Disabled (demo)</option>
            </select>
          </div>
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 12 }}>
          <div style={{ fontWeight: 900 }}>Current settings snapshot</div>
          <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
            {"In production, policy versions are included in evidence packs and event metadata."}
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatusPill text={"Segregated account: " + (settings.accounts.segregatedAccountEnabled ? "ON" : "OFF")} />
            <StatusPill text={"MFA for admin: " + (settings.security.mfaRequiredForAdmin ? "ON" : "OFF")} />
            <StatusPill text={"Regulator portal: " + (settings.export.regulatorPortalEnabled ? "ON" : "OFF")} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <button className="apgms-proto__btn apgms-proto__btn--primary" onClick={save}>Save policy changes (demo)</button>
        <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
          {"Saving produces a policy update event so it can be evidenced later."}
        </div>
      </div>
    </div>
  );
}
TSX

cat > "$WEBAPP_DIR/src/prototype/pages/IncidentsPage.tsx" <<'TSX'
import React, { useMemo, useState } from "react";
import { useDemoStore } from "../store";
import { StatusPill } from "../components/StatusPill";

export default function IncidentsPage() {
  const { incidents, obligations, createIncident, period } = useDemoStore();
  const [title, setTitle] = useState("Feed delay");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");
  const [description, setDescription] = useState("Bank feed delayed beyond expected interval. Review integration and reconcile once received.");
  const [obId, setObId] = useState("");

  const rows = useMemo(() => incidents.filter((i) => i.period === period), [incidents, period]);

  const submit = () => {
    createIncident({
      title: title.trim() || "Incident",
      severity,
      description: description.trim() || "Incident created in demo.",
      obligationIds: obId ? [obId] : [],
    });
  };

  return (
    <div className="apgms-proto__section">
      <div className="apgms-proto__h1">Incidents</div>
      <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
        {"Incidents are first-class so operational failures become explainable and evidenced."}
      </div>

      <div style={{ marginTop: 12, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 12 }}>
        <div style={{ fontWeight: 900 }}>Create incident (demo)</div>
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(2, minmax(240px, 1fr))", gap: 10 }}>
          <div>
            <label className="apgms-proto__muted">Title</label>
            <input className="apgms-proto__input" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", marginTop: 6 }} />
          </div>
          <div>
            <label className="apgms-proto__muted">Severity</label>
            <select className="apgms-proto__input" value={severity} onChange={(e) => setSeverity(e.target.value as any)} style={{ width: "100%", marginTop: 6 }}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="apgms-proto__muted">Description</label>
            <input className="apgms-proto__input" value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: "100%", marginTop: 6 }} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="apgms-proto__muted">Link to obligation (optional)</label>
            <select className="apgms-proto__input" value={obId} onChange={(e) => setObId(e.target.value)} style={{ width: "100%", marginTop: 6 }}>
              <option value="">No linked obligation</option>
              {obligations.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <button className="apgms-proto__btn apgms-proto__btn--primary" onClick={submit}>Create incident</button>
        </div>
      </div>

      <table className="apgms-proto__table">
        <thead>
          <tr>
            <th style={{ width: 190 }}>Time</th>
            <th style={{ width: 120 }}>Severity</th>
            <th style={{ width: 120 }}>Status</th>
            <th>Title</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 40).map((i) => (
            <tr key={i.id}>
              <td style={{ opacity: 0.8 }}>{new Date(i.ts).toLocaleString()}</td>
              <td><StatusPill text={i.severity} /></td>
              <td><StatusPill text={i.status} /></td>
              <td style={{ opacity: 0.9 }}>
                <div style={{ fontWeight: 800 }}>{i.title}</div>
                <div className="apgms-proto__muted" style={{ marginTop: 4 }}>{i.description}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
TSX

cat > "$WEBAPP_DIR/src/prototype/pages/SettingsPage.tsx" <<'TSX'
import React, { useState } from "react";
import { useDemoStore } from "../store";

function Section(props: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 12 }}>
      <div style={{ fontWeight: 900 }}>{props.title}</div>
      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6, lineHeight: 1.35 }}>{props.subtitle}</div>
      <div style={{ marginTop: 10 }}>{props.children}</div>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{props.label}</div>
      <div style={{ marginTop: 6 }}>{props.children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, updateSettings, resetDemoState } = useDemoStore();

  const [seed, setSeed] = useState(settings.simulation.seed);
  const [interval, setInterval] = useState(String(settings.simulation.feedIntervalSeconds));

  const saveSimulation = () => {
    const seconds = Math.max(10, Math.min(600, parseInt(interval, 10) || settings.simulation.feedIntervalSeconds));
    updateSettings({ simulation: { ...settings.simulation, seed: seed.trim() || settings.simulation.seed, feedIntervalSeconds: seconds } });
  };

  return (
    <div className="apgms-proto__section">
      <div className="apgms-proto__h1">Settings</div>
      <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
        {"Deployable configuration surface. Values are demo-only but structured to match a production-grade settings model."}
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(2, minmax(260px, 1fr))", gap: 12 }}>
        <Section title="Organization" subtitle="Name, ABN, time zone, and reporting calendar.">
          <Field label="Organization name">
            <input
              className="apgms-proto__input"
              value={settings.organization.name}
              onChange={(e) => updateSettings({ organization: { ...settings.organization, name: e.target.value } } as any)}
              style={{ width: "100%" }}
            />
          </Field>
          <Field label="ABN (demo)">
            <input
              className="apgms-proto__input"
              value={settings.organization.abn}
              onChange={(e) => updateSettings({ organization: { ...settings.organization, abn: e.target.value } } as any)}
              style={{ width: "100%" }}
            />
          </Field>
          <Field label="Time zone">
            <input
              className="apgms-proto__input"
              value={settings.organization.timeZone}
              onChange={(e) => updateSettings({ organization: { ...settings.organization, timeZone: e.target.value } } as any)}
              style={{ width: "100%" }}
            />
          </Field>
        </Section>

        <Section title="Period & obligations" subtitle="Cadence, due date rules, and reminders.">
          <Field label="Cadence">
            <select
              className="apgms-proto__input"
              value={settings.periods.cadence}
              onChange={(e) => updateSettings({ periods: { ...settings.periods, cadence: e.target.value as any } } as any)}
              style={{ width: "100%" }}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </Field>
          <Field label="Reminder days before due">
            <input
              className="apgms-proto__input"
              value={String(settings.periods.reminderDaysBeforeDue)}
              onChange={(e) => updateSettings({ periods: { ...settings.periods, reminderDaysBeforeDue: parseInt(e.target.value, 10) || 14 } } as any)}
              style={{ width: "100%" }}
            />
          </Field>
        </Section>

        <Section title="Accounts" subtitle="Operating, tax buffer, and segregated account mapping.">
          <Field label="Operating account label">
            <input
              className="apgms-proto__input"
              value={settings.accounts.operatingAccountLabel}
              onChange={(e) => updateSettings({ accounts: { ...settings.accounts, operatingAccountLabel: e.target.value } } as any)}
              style={{ width: "100%" }}
            />
          </Field>
          <Field label="Tax buffer account label">
            <input
              className="apgms-proto__input"
              value={settings.accounts.taxBufferAccountLabel}
              onChange={(e) => updateSettings({ accounts: { ...settings.accounts, taxBufferAccountLabel: e.target.value } } as any)}
              style={{ width: "100%" }}
            />
          </Field>
          <Field label="Segregated account enabled">
            <select
              className="apgms-proto__input"
              value={settings.accounts.segregatedAccountEnabled ? "yes" : "no"}
              onChange={(e) => updateSettings({ accounts: { ...settings.accounts, segregatedAccountEnabled: e.target.value === "yes" } } as any)}
              style={{ width: "100%" }}
            >
              <option value="yes">Yes (recommended)</option>
              <option value="no">No</option>
            </select>
          </Field>
        </Section>

        <Section title="Integrations" subtitle="Bank feed, accounting, payroll (demo states).">
          <Field label="Bank feed">
            <select
              className="apgms-proto__input"
              value={settings.integrations.bankFeed}
              onChange={(e) => updateSettings({ integrations: { ...settings.integrations, bankFeed: e.target.value as any } } as any)}
              style={{ width: "100%" }}
            >
              <option value="connected_demo">Connected (demo)</option>
              <option value="not_connected">Not connected</option>
            </select>
          </Field>
          <Field label="Accounting">
            <select
              className="apgms-proto__input"
              value={settings.integrations.accounting}
              onChange={(e) => updateSettings({ integrations: { ...settings.integrations, accounting: e.target.value as any } } as any)}
              style={{ width: "100%" }}
            >
              <option value="not_connected">Not connected</option>
              <option value="connected_demo">Connected (demo)</option>
            </select>
          </Field>
          <Field label="Payroll">
            <select
              className="apgms-proto__input"
              value={settings.integrations.payroll}
              onChange={(e) => updateSettings({ integrations: { ...settings.integrations, payroll: e.target.value as any } } as any)}
              style={{ width: "100%" }}
            >
              <option value="not_connected">Not connected</option>
              <option value="connected_demo">Connected (demo)</option>
            </select>
          </Field>
        </Section>

        <Section title="Notifications" subtitle="Email/webhook toggles (demo).">
          <Field label="Email notifications">
            <select
              className="apgms-proto__input"
              value={settings.notifications.emailEnabled ? "on" : "off"}
              onChange={(e) => updateSettings({ notifications: { ...settings.notifications, emailEnabled: e.target.value === "on" } } as any)}
              style={{ width: "100%" }}
            >
              <option value="on">Enabled</option>
              <option value="off">Disabled</option>
            </select>
          </Field>
          <Field label="Webhook notifications">
            <select
              className="apgms-proto__input"
              value={settings.notifications.webhookEnabled ? "on" : "off"}
              onChange={(e) => updateSettings({ notifications: { ...settings.notifications, webhookEnabled: e.target.value === "on" } } as any)}
              style={{ width: "100%" }}
            >
              <option value="off">Disabled</option>
              <option value="on">Enabled</option>
            </select>
          </Field>
        </Section>

        <Section title="Security" subtitle="MFA policy, session timeout, and admin roles (demo).">
          <Field label="MFA required for admin">
            <select
              className="apgms-proto__input"
              value={settings.security.mfaRequiredForAdmin ? "yes" : "no"}
              onChange={(e) => updateSettings({ security: { ...settings.security, mfaRequiredForAdmin: e.target.value === "yes" } } as any)}
              style={{ width: "100%" }}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Session timeout (minutes)">
            <input
              className="apgms-proto__input"
              value={String(settings.security.sessionTimeoutMinutes)}
              onChange={(e) => updateSettings({ security: { ...settings.security, sessionTimeoutMinutes: parseInt(e.target.value, 10) || 30 } } as any)}
              style={{ width: "100%" }}
            />
          </Field>
        </Section>

        <Section title="Data retention" subtitle="Event/log retention windows (demo).">
          <Field label="Event retention (days)">
            <input
              className="apgms-proto__input"
              value={String(settings.retention.eventRetentionDays)}
              onChange={(e) => updateSettings({ retention: { ...settings.retention, eventRetentionDays: parseInt(e.target.value, 10) || 365 } } as any)}
              style={{ width: "100%" }}
            />
          </Field>
          <Field label="Evidence pack retention (days)">
            <input
              className="apgms-proto__input"
              value={String(settings.retention.evidencePackRetentionDays)}
              onChange={(e) => updateSettings({ retention: { ...settings.retention, evidencePackRetentionDays: parseInt(e.target.value, 10) || 3650 } } as any)}
              style={{ width: "100%" }}
            />
          </Field>
        </Section>

        <Section title="Export" subtitle="Evidence pack defaults and regulator portal settings (demo).">
          <Field label="Default evidence pack scope">
            <select
              className="apgms-proto__input"
              value={settings.export.defaultEvidencePackScope}
              onChange={(e) => updateSettings({ export: { ...settings.export, defaultEvidencePackScope: e.target.value as any } } as any)}
              style={{ width: "100%" }}
            >
              <option value="obligation">Obligation</option>
              <option value="period">Period</option>
            </select>
          </Field>
          <Field label="Regulator portal enabled">
            <select
              className="apgms-proto__input"
              value={settings.export.regulatorPortalEnabled ? "on" : "off"}
              onChange={(e) => updateSettings({ export: { ...settings.export, regulatorPortalEnabled: e.target.value === "on" } } as any)}
              style={{ width: "100%" }}
            >
              <option value="on">Enabled</option>
              <option value="off">Disabled</option>
            </select>
          </Field>
        </Section>

        <Section title="Simulation" subtitle="Deterministic incoming feed events (default interval is less frequent).">
          <Field label="Seed (deterministic)">
            <input className="apgms-proto__input" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ width: "100%" }} />
          </Field>
          <Field label="Feed interval (seconds)">
            <input className="apgms-proto__input" value={interval} onChange={(e) => setInterval(e.target.value)} style={{ width: "100%" }} />
          </Field>
          <button className="apgms-proto__btn apgms-proto__btn--primary" onClick={saveSimulation}>Save simulation settings</button>
        </Section>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="apgms-proto__btn" onClick={resetDemoState}>Reset demo state</button>
        <div className="apgms-proto__muted" style={{ alignSelf: "center" }}>
          {"Reset clears local demo state so the runbook steps behave the same each time."}
        </div>
      </div>
    </div>
  );
}
TSX

cat > "$WEBAPP_DIR/src/prototype/pages/RegulatorPortalPage.tsx" <<'TSX'
import React from "react";
import { useDemoStore } from "../store";
import { StatusPill } from "../components/StatusPill";

export default function RegulatorPortalPage() {
  const { period, obligations, evidencePacks, incidents, settings } = useDemoStore();

  return (
    <div className="apgms-proto__section">
      <div className="apgms-proto__h1">Regulator Portal (read-only)</div>
      <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
        {"Assessor view: minimum necessary access, reproducible artifacts, and no write actions."}
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <StatusPill text={"Period: " + period} />
        <StatusPill text={"Portal: " + (settings.export.regulatorPortalEnabled ? "ENABLED" : "DISABLED")} />
        <StatusPill text={"Obligations: " + String(obligations.length)} />
        <StatusPill text={"Packs: " + String(evidencePacks.filter((p) => p.period === period).length)} />
        <StatusPill text={"Incidents: " + String(incidents.filter((i) => i.period === period).length)} />
      </div>

      <div style={{ marginTop: 12, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 12 }}>
        <div style={{ fontWeight: 900 }}>Compliance summary (demo)</div>
        <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
          {"This mirrors the endpoint-backed view. In production this would be read-only and backed by signed evidence pack artifacts."}
        </div>

        <table className="apgms-proto__table">
          <thead>
            <tr>
              <th style={{ width: 120 }}>Tax type</th>
              <th>Obligation</th>
              <th style={{ width: 160 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {obligations.map((o) => (
              <tr key={o.id}>
                <td><StatusPill text={o.taxType} /></td>
                <td style={{ opacity: 0.9 }}>{o.label}</td>
                <td><StatusPill text={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12 }} className="apgms-proto__muted">
        {"No controls are available here. This is intentionally read-only."}
      </div>
    </div>
  );
}
TSX

cat > "$WEBAPP_DIR/src/prototype/pages/DemoGuidePage.tsx" <<'TSX'
import React from "react";
import { Link } from "react-router-dom";
import { useDemoStore } from "../store";

export default function DemoGuidePage() {
  const { settings, toggleSimulation, resetDemoState } = useDemoStore();

  return (
    <div className="apgms-proto__section">
      <div className="apgms-proto__h1">Demo Guide</div>
      <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
        {"Use this for self-serve or keep DEMO_RUNBOOK.md as your live talk track. This page is intentionally short and click-driven."}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="apgms-proto__btn apgms-proto__btn--primary" onClick={() => toggleSimulation(!settings.simulation.enabled)}>
          {"Simulation: " + (settings.simulation.enabled ? "ON" : "OFF")}
        </button>
        <button className="apgms-proto__btn" onClick={resetDemoState}>Reset demo state</button>
      </div>

      <ol style={{ marginTop: 12, paddingLeft: 18, lineHeight: 1.6, opacity: 0.9 }}>
        <li>
          <Link to="/proto/dashboard" style={{ color: "inherit" }}>Dashboard</Link>: confirm period, tiles, recent activity.
        </li>
        <li>
          <Link to="/proto/obligations" style={{ color: "inherit" }}>Obligations</Link>: open BAS, run reconciliation, prepare and submit lodgment, generate evidence pack.
        </li>
        <li>
          <Link to="/proto/ledger" style={{ color: "inherit" }}>Ledger</Link>: filter to obligation and show traceability.
        </li>
        <li>
          <Link to="/proto/reconciliation" style={{ color: "inherit" }}>Reconciliation</Link>: resolve an unmatched feed line if present.
        </li>
        <li>
          <Link to="/proto/evidence" style={{ color: "inherit" }}>Evidence Pack</Link>: open latest pack and show manifest hash + diff note.
        </li>
        <li>
          <Link to="/proto/controls" style={{ color: "inherit" }}>Controls & Policies</Link>: save a change to generate a policy event.
        </li>
        <li>
          <Link to="/proto/incidents" style={{ color: "inherit" }}>Incidents</Link>: create a "Feed delay" incident and link an obligation.
        </li>
        <li>
          <Link to="/proto/settings" style={{ color: "inherit" }}>Settings</Link>: show deployable configuration sections and simulation interval (less frequent by default).
        </li>
        <li>
          <Link to="/proto/regulator" style={{ color: "inherit" }}>Regulator Portal</Link>: show read-only compliance summary and packs/incidents counters.
        </li>
      </ol>

      <div className="apgms-proto__muted" style={{ marginTop: 10 }}>
        {"Tip: For a live demo, follow DEMO_RUNBOOK.md. For self-serve demos, this page is sufficient."}
      </div>
    </div>
  );
}
TSX

# ----------------------------
# Prototype shell + routing
# ----------------------------
cat > "$WEBAPP_DIR/src/prototype/PrototypeShell.tsx" <<'TSX'
import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useDemoStore } from "./store";
import "./prototype.css";

const PERIODS = ["2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4"] as const;

export default function PrototypeShell() {
  const { user, logout } = useAuth();
  const { period, setPeriod, settings, toggleSimulation, resetDemoState } = useDemoStore();

  return (
    <div className="apgms-proto">
      <aside className="apgms-proto__sidebar">
        <div className="apgms-proto__brand">
          <div>
            <div className="apgms-proto__title">APGMS</div>
            <div className="apgms-proto__subtitle">Console (Demo Mode)</div>
          </div>
          <span className="apgms-proto__badge">admin-only</span>
        </div>

        <nav className="apgms-proto__nav">
          <NavLink to="/proto/dashboard">Dashboard</NavLink>
          <NavLink to="/proto/obligations">Obligations</NavLink>
          <NavLink to="/proto/ledger">Ledger</NavLink>
          <NavLink to="/proto/reconciliation">Reconciliation</NavLink>
          <NavLink to="/proto/evidence">Evidence Pack</NavLink>
          <NavLink to="/proto/controls">Controls & Policies</NavLink>
          <NavLink to="/proto/incidents">Incidents</NavLink>
          <NavLink to="/proto/settings">Settings</NavLink>
          <NavLink to="/proto/regulator">Regulator Portal (read-only)</NavLink>
          <NavLink to="/proto/demo">Demo Guide</NavLink>
        </nav>

        <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Signed in</div>
          <div style={{ fontSize: 13, fontWeight: 800, marginTop: 6 }}>{user?.name} (admin)</div>
          <button className="apgms-proto__btn" onClick={logout} style={{ marginTop: 10 }}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="apgms-proto__main">
        <div className="apgms-proto__topbar">
          <div className="apgms-proto__topbar-left">
            <select className="apgms-proto__input" value={period} onChange={(e) => setPeriod(e.target.value as any)}>
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <input className="apgms-proto__input" placeholder="Search (demo)" style={{ width: 260 }} />
          </div>

          <div className="apgms-proto__topbar-right">
            <button
              className={"apgms-proto__btn " + (settings.simulation.enabled ? "apgms-proto__btn--primary" : "")}
              onClick={() => toggleSimulation(!settings.simulation.enabled)}
              title={"Incoming feed simulation (default interval " + settings.simulation.feedIntervalSeconds + "s)"}
            >
              {"Simulation " + (settings.simulation.enabled ? "ON" : "OFF")}
            </button>

            <button className="apgms-proto__btn" onClick={resetDemoState}>
              Reset demo state
            </button>
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}
TSX

cat > "$WEBAPP_DIR/src/prototype/PrototypeApp.tsx" <<'TSX'
import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { DemoStoreProvider } from "./store";
import PrototypeShell from "./PrototypeShell";

import DashboardPage from "./pages/DashboardPage";
import ObligationsPage from "./pages/ObligationsPage";
import ObligationDetailPage from "./pages/ObligationDetailPage";
import LedgerPage from "./pages/LedgerPage";
import ReconciliationPage from "./pages/ReconciliationPage";
import EvidencePackPage from "./pages/EvidencePackPage";
import ControlsPoliciesPage from "./pages/ControlsPoliciesPage";
import IncidentsPage from "./pages/IncidentsPage";
import SettingsPage from "./pages/SettingsPage";
import RegulatorPortalPage from "./pages/RegulatorPortalPage";
import DemoGuidePage from "./pages/DemoGuidePage";

function RequireAdmin(props: { children: React.ReactNode }) {
  const { user, isAdmin } = useAuth();
  const loc = useLocation();

  if (!user) return <Navigate to="/" replace />;
  if (!isAdmin) {
    // Direct URL protection: non-admin redirected away
    return <Navigate to="/" replace state={{ from: loc.pathname }} />;
  }
  return <>{props.children}</>;
}

export function PrototypeApp() {
  return (
    <RequireAdmin>
      <DemoStoreProvider>
        <Routes>
          <Route element={<PrototypeShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/obligations" element={<ObligationsPage />} />
            <Route path="/obligations/:obligationId" element={<ObligationDetailPage />} />
            <Route path="/ledger" element={<LedgerPage />} />
            <Route path="/reconciliation" element={<ReconciliationPage />} />
            <Route path="/evidence" element={<EvidencePackPage />} />
            <Route path="/controls" element={<ControlsPoliciesPage />} />
            <Route path="/incidents" element={<IncidentsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/regulator" element={<RegulatorPortalPage />} />
            <Route path="/demo" element={<DemoGuidePage />} />
            <Route path="/" element={<Navigate to="/proto/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/proto/dashboard" replace />} />
          </Route>
        </Routes>
      </DemoStoreProvider>
    </RequireAdmin>
  );
}
TSX

# ----------------------------
# DEMO_RUNBOOK.md (repo root)
# ----------------------------
cat > "$REPO_ROOT/DEMO_RUNBOOK.md" <<'MD'
# APGMS Demo Runbook (Production-like, Demo Mode)

## Demo positioning (opening line)
APGMS is a control-plane and evidence system for tax obligations: it ingests transaction feeds, enforces funding and reconciliation controls, orchestrates lodgment and payment steps, and produces regulator-grade evidence packs.

## Login + admin gating (required behavior)
- Login as user: you must NOT see the prototype entry button.
- Login as admin: you see one entry button: "Open APGMS Console (Demo Mode)".
- Direct URL protection: non-admin hitting /proto/* is redirected to the normal home.

## Left nav (production model)
Follow this IA in the demo:
1) Dashboard
2) Obligations
3) Ledger
4) Reconciliation
5) Evidence Pack
6) Controls & Policies
7) Incidents
8) Settings
9) Regulator Portal (read-only)

## Recommended demo structure
Use the app to click through the flow, and keep this file as your talk track.
In-app "Demo Guide" exists at /proto/demo for self-serve demos.

## Demo script (click-by-click)

### A) Dashboard (60-90 seconds)
Show:
- Period switcher (2025-Q1)
- Status tiles: Funded, Reconcile pending, Ready to lodge, Overdue risk
- Recent activity feed (events timeline)

Say:
- The dashboard is the operational truth: obligations, blockers, and control status by period.
- Everything is event-backed so we can generate evidence packs later.

Action:
- Toggle Simulation ON
- Wait for an event to arrive (default feed interval is 45 seconds)
- Call out: "Bank feed received", "Ledger posted", "Match suggestion created"

### B) Obligations (2-3 minutes)
Show:
- Obligation list grouped by tax type
- Lifecycle: Fund, Reconcile, Lodge, Pay, Evidence

Say:
- This is the workflow engine view. We enforce preconditions before lodgment or payment.

Actions:
- Open BAS 2025-Q1
- Click "Run reconciliation"
- If blockers exist, go to Reconciliation to resolve an unmatched feed line, then re-run reconciliation
- Click "Prepare lodgment (demo)"
- Click "Submit lodgment (demo)"
- Click "Generate evidence pack"

### C) Ledger (60-120 seconds)
Show:
- Ledger entries tagged by obligation, period, and source

Say:
- Ledger is the audit spine. Every derived figure traces back to entries and events.

Action:
- Filter to the obligation you just lodged (optional if filter is present)

### D) Reconciliation (2 minutes)
Show:
- Bank feed lines: matched, unmatched, suggested
- Exceptions behavior

Say:
- This is the control gate. We do not allow lodgment based on unverified inputs.

Action:
- Resolve one unmatched item (mark business, tax, or excluded)

### E) Evidence Pack (2 minutes)
Show:
- Evidence pack list by period and obligation
- Manifest hash + pack items + "What changed" section

Say:
- This is the artifact you hand to an assessor/regulator. It is reproducible: same inputs, same outputs, same hashes.

### F) Controls & Policies (90 seconds)
Show:
- Funding policy
- Reconciliation policy
- Access policy

Say:
- Controls are explicit and versioned. You can show exactly which policy version was in force for any event.

Action:
- Save a policy change (demo) and note the policy update event

### G) Incidents (90 seconds)
Show:
- Incident list: severity, status, timestamps
- Create incident

Say:
- Incidents are first-class so operational failures become explainable and evidenced.

Action:
- Create "Feed delay" incident and optionally link it to BAS

### H) Settings (2-3 minutes)
Show sections:
- Organization: name, ABN (demo), time zone, reporting calendar
- Period & obligations: cadence, due date rules, reminders
- Accounts: operating, tax buffer, segregated mapping
- Integrations: bank feed/accounting/payroll (demo states)
- Notifications: email/webhook toggles
- Security: MFA policy, session timeout, admin roles
- Data retention: event + evidence retention
- Export: evidence defaults, regulator portal
- Simulation: seed + interval (default is less frequent)

Say:
- Settings is where APGMS becomes deployable per organization while staying compliant and auditable.

Action:
- Adjust Simulation interval (for the demo, keep it slower)
- Optionally reset demo state to restart the narrative

### I) Regulator Portal (read-only) (90 seconds)
Show:
- Read-only compliance summary for the period
- Packs/incidents counters
- No write actions

Say:
- This is the assessor view: minimum necessary access with reproducible artifacts.

## Reset rule (determinism)
If anything drifts during a live demo, use "Reset demo state" so steps behave the same again.
MD

echo "OK: Scaffold written."
echo ""
echo "Next:"
echo "  pnpm --dir webapp dev -- --host 0.0.0.0 --port 5173"
echo ""
echo "Demo:"
echo "  Login as admin -> Open APGMS Console (Demo Mode) -> /proto/demo"
