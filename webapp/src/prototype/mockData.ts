export type Period = "2025-Q1" | "2025-Q2" | "2025-Q3" | "2025-Q4";

export type ObligationType = "BAS" | "PAYGW" | "PAYGI" | "SUPER" | "FBT" | "IAS";

export type ObligationStatus = "draft" | "funding" | "ready" | "lodged" | "paid" | "overdue" | "blocked";

export type Obligation = {
  id: string;
  period: Period;
  type: ObligationType;
  dueDate: string; // YYYY-MM-DD
  amountDueCents: number;
  fundedCents: number;
  status: ObligationStatus;
  lastUpdated: string; // ISO
};

export type LedgerEntry = {
  id: string;
  ts: string; // ISO
  account: "Operating" | "Tax Buffer" | "GST Holding" | "PAYGW Holding" | "Super Holding";
  direction: "in" | "out";
  amountCents: number;
  reference: string;
  counterparty: string;
};

export type EvidencePack = {
  id: string;
  period: Period;
  createdAt: string;
  manifestLines: string[];
};

export type Control = {
  id: string;
  area: "Security" | "Privacy" | "Financial Controls" | "Change Control" | "Reconciliation" | "Incident Mgmt";
  name: string;
  status: "pass" | "warn" | "fail";
  notes: string;
};

export type Incident = {
  id: string;
  openedAt: string;
  severity: "SEV-1" | "SEV-2" | "SEV-3";
  title: string;
  status: "open" | "mitigated" | "closed";
  owner: string;
  notes: string;
};

export type MockState = {
  currentPeriod: Period;
  obligations: Obligation[];
  ledger: LedgerEntry[];
  controls: Control[];
  incidents: Incident[];
  evidencePacks: EvidencePack[];
  settings: {
    orgName: string;
    environment: "local" | "staging" | "prod-sim";
    regulatorMode: boolean;
  };
  reconciliation: {
    lastRunAt: string | null;
    unmatchedCount: number;
    matchedCount: number;
    notes: string;
  };
  feeds: {
    lastIngestAt: string | null;
    items: { id: string; ts: string; source: string; kind: string; status: "ok" | "warn" | "fail" }[];
  };
};

function nowIso() {
  return new Date().toISOString();
}

function cents(n: number) {
  return Math.round(n * 100);
}

function id(prefix: string, n: number) {
  return `${prefix}_${n.toString().padStart(4, "0")}`;
}

export function createInitialMockState(): MockState {
  const currentPeriod: Period = "2025-Q1";

  const obligations: Obligation[] = [
    { id: id("obl", 1), period: "2025-Q1", type: "BAS", dueDate: "2025-04-28", amountDueCents: cents(12850.22), fundedCents: cents(9900.00), status: "funding", lastUpdated: nowIso() },
    { id: id("obl", 2), period: "2025-Q1", type: "PAYGW", dueDate: "2025-04-21", amountDueCents: cents(8420.10), fundedCents: cents(8420.10), status: "ready", lastUpdated: nowIso() },
    { id: id("obl", 3), period: "2025-Q1", type: "SUPER", dueDate: "2025-04-28", amountDueCents: cents(6240.00), fundedCents: cents(6240.00), status: "paid", lastUpdated: nowIso() },
    { id: id("obl", 4), period: "2025-Q2", type: "BAS", dueDate: "2025-07-28", amountDueCents: cents(15440.00), fundedCents: cents(2500.00), status: "draft", lastUpdated: nowIso() },
    { id: id("obl", 5), period: "2025-Q2", type: "PAYGW", dueDate: "2025-07-21", amountDueCents: cents(9100.00), fundedCents: cents(0), status: "draft", lastUpdated: nowIso() },
  ];

  const ledger: LedgerEntry[] = [
    { id: id("led", 1), ts: "2025-03-01T10:12:00.000Z", account: "Operating", direction: "in", amountCents: cents(32000), reference: "INVOICE_1042", counterparty: "Customer A" },
    { id: id("led", 2), ts: "2025-03-02T02:14:00.000Z", account: "PAYGW Holding", direction: "in", amountCents: cents(2100), reference: "SWEEP_PAYRUN_18", counterparty: "APGMS Auto-sweep" },
    { id: id("led", 3), ts: "2025-03-03T04:31:00.000Z", account: "GST Holding", direction: "in", amountCents: cents(1800), reference: "SWEEP_WEEKLY_09", counterparty: "APGMS Auto-sweep" },
    { id: id("led", 4), ts: "2025-03-05T06:55:00.000Z", account: "Operating", direction: "out", amountCents: cents(9600), reference: "PAYROLL_MAR", counterparty: "Payroll" },
    { id: id("led", 5), ts: "2025-03-10T01:05:00.000Z", account: "Tax Buffer", direction: "in", amountCents: cents(1200), reference: "TOPUP_BUFFER", counterparty: "APGMS Policy" },
  ];

  const controls: Control[] = [
    { id: id("ctl", 1), area: "Security", name: "PII redaction in logs", status: "pass", notes: "Patterns: TFN/ABN/BSB+ACC redacted (demo)." },
    { id: id("ctl", 2), area: "Change Control", name: "Schema migrations gated", status: "warn", notes: "Prisma config deprecation warning present; migrate to prisma.config.ts before prod." },
    { id: id("ctl", 3), area: "Reconciliation", name: "Ledger-to-obligation reconciliation", status: "warn", notes: "Mock engine. Wire to real ledger + obligation policy layer." },
    { id: id("ctl", 4), area: "Incident Mgmt", name: "Incident lifecycle", status: "pass", notes: "Create/mitigate/close supported in prototype." },
  ];

  const incidents: Incident[] = [
    { id: id("inc", 1), openedAt: "2025-03-06T09:00:00.000Z", severity: "SEV-2", title: "Bank feed delay (mock)", status: "mitigated", owner: "Ops", notes: "Holding balances remain consistent; monitoring." },
    { id: id("inc", 2), openedAt: "2025-03-11T03:20:00.000Z", severity: "SEV-3", title: "One-way account sweep retry (mock)", status: "open", owner: "Worker", notes: "Retry scheduled; no customer impact." },
  ];

  const evidencePacks: EvidencePack[] = [
    {
      id: id("epk", 1),
      period: "2025-Q1",
      createdAt: "2025-04-01T01:10:00.000Z",
      manifestLines: [
        "manifest_version: 1",
        "period: 2025-Q1",
        "item: obligations_snapshot.json checksum: 7d2a-demo",
        "item: ledger_snapshot.json checksum: 91af-demo",
        "item: controls_snapshot.json checksum: 22c0-demo",
      ],
    },
  ];

  return {
    currentPeriod,
    obligations,
    ledger,
    controls,
    incidents,
    evidencePacks,
    settings: {
      orgName: "Org 1 (Demo)",
      environment: "prod-sim",
      regulatorMode: false,
    },
    reconciliation: {
      lastRunAt: null,
      unmatchedCount: 3,
      matchedCount: 18,
      notes: "Mock reconciliation not yet run in this session.",
    },
    feeds: {
      lastIngestAt: null,
      items: [
        { id: id("fd", 1), ts: "2025-03-01T00:05:00.000Z", source: "Bank", kind: "Transactions", status: "ok" },
        { id: id("fd", 2), ts: "2025-03-02T00:05:00.000Z", source: "Payroll", kind: "Payrun", status: "ok" },
        { id: id("fd", 3), ts: "2025-03-03T00:05:00.000Z", source: "POS", kind: "Sales", status: "warn" },
      ],
    },
  };
}

export function formatAud(centsValue: number) {
  const v = centsValue / 100;
  return v.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

export function simpleChecksum(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = h >>> 0;
  return u.toString(16).padStart(8, "0");
}
