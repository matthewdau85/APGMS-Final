export type TaxType = "GST" | "PAYGW" | "PAYGI" | "SUPER";

export type ObligationStatus =
  | "reconcile_pending"
  | "funded"
  | "ready_to_lodge"
  | "lodged"
  | "overdue_risk";

export type Severity = "low" | "medium" | "high";

export type DemoEventType =
  | "DEMO_SEEDED"
  | "CONNECTOR_IN_BANK"
  | "CONNECTOR_IN_PAYROLL"
  | "CONNECTOR_IN_ACCOUNTING"
  | "LEDGER_POSTED"
  | "OBLIGATION_UPDATED"
  | "RECONCILIATION_RUN"
  | "LODGE_PREPARED"
  | "LODGE_SUBMITTED"
  | "EVIDENCE_PACK_GENERATED"
  | "INCIDENT_CREATED"
  | "SIM_STARTED"
  | "SIM_STOPPED";

export type PeriodKey = string;

export type DemoEvent = {
  id: string;
  ts: number;
  type: DemoEventType;
  orgId: string;
  period?: PeriodKey;
  message: string;
  data?: Record<string, unknown>;
};

export type Organization = {
  id: string;
  name: string;
  abn: string;
  timeZone: string;
  reportingCalendar: "standard" | "custom";
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
    bankFeed: "connected_demo" | "not_connected";
    accounting: "connected_demo" | "not_connected";
    payroll: "connected_demo" | "not_connected";
  };
  simulation: {
    enabled: boolean;
    feedIntervalSeconds: number;
    seed: string;
  };
};

export type Obligation = {
  id: string;
  orgId: string;
  period: PeriodKey;
  taxType: TaxType;
  label: string;
  dueDate: string; // YYYY-MM-DD
  amountCents: number;
  status: ObligationStatus;
  blockers: string[];
};

export type BankLine = {
  id: string;
  orgId: string;
  ts: number;
  postedDate: string; // YYYY-MM-DD
  description: string;
  amountCents: number; // positive inflow, negative outflow
  status: "unreconciled" | "reconciled" | "excluded";
  resolvedAs?: "business" | "tax" | "excluded";
};

export type LedgerEntry = {
  id: string;
  orgId: string;
  ts: number;
  postedDate: string;
  account: "operating" | "tax_buffer";
  direction: "debit" | "credit";
  amountCents: number;
  memo: string;
  ref?: string;
};

export type EvidencePack = {
  id: string;
  orgId: string;
  ts: number;
  obligationId: string;
  period: PeriodKey;
  checksum: string;
  scope: "obligation";
};

export type Incident = {
  id: string;
  orgId: string;
  ts: number;
  title: string;
  severity: Severity;
  description: string;
  obligationIds: string[];
  status: "open" | "resolved";
};

export type DemoState = {
  org: Organization;
  settings: SettingsModel;
  events: DemoEvent[];
  obligations: Obligation[];
  bankLines: BankLine[];
  ledger: LedgerEntry[];
  evidencePacks: EvidencePack[];
  incidents: Incident[];
};

export function nowIso(ts: number): string {
  return new Date(ts).toISOString();
}

export function ymd(ts: number): string {
  const d = new Date(ts);
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function id(prefix: string, ts: number, n: number): string {
  return `${prefix}_${ts}_${n}`;
}

export function clampInt(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

// Deterministic RNG from a string seed (simple LCG)
export function makeRng(seed: string): () => number {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function pick<T>(rng: () => number, items: T[]): T {
  const idx = clampInt(Math.floor(rng() * items.length), 0, items.length - 1);
  return items[idx];
}

export function checksumToy(input: string): string {
  // Not crypto. Good enough for demo determinism.
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `demo_${h.toString(16).padStart(8, "0")}`;
}
