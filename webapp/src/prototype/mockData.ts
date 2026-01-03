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
