export type PeriodId = "2025-Q1" | "2025-Q2" | "2025-Q3" | "2025-Q4";

export type EventType =
  | "feed.received"
  | "ledger.posted"
  | "recon.suggested"
  | "recon.completed"
  | "lodgment.prepared"
  | "lodgment.submitted"
  | "payment.queued"
  | "evidence.generated"
  | "policy.updated"
  | "incident.created"
  | "incident.updated"
  | "demo.reset";

export type DemoEvent = {
  id: string;
  ts: number;
  type: EventType;
  message: string;
  meta?: Record<string, unknown>;
};

export type ObligationStage = "Fund" | "Reconcile" | "Lodge" | "Pay" | "Evidence";
export type ObligationStatus = "OK" | "Action required" | "Overdue risk";

export type Obligation = {
  id: string;
  period: PeriodId;
  taxType: "BAS" | "PAYGW" | "Super" | "PAYGI";
  label: string;
  dueDate: string; // demo date
  amountDueAUD: number;
  status: ObligationStatus;
  stage: ObligationStage;
  fundedPct: number;
  reconcileOpen: number;
  hasDraftLodgment: boolean;
  lodged: boolean;
  paid: boolean;
  evidencePacks: number;
  blockers: string[];
};

export type LedgerEntry = {
  id: string;
  ts: number;
  period: PeriodId;
  obligationId: string;
  account: "Operating" | "Tax Buffer" | "Trust";
  direction: "credit" | "debit";
  amountAUD: number;
  memo: string;
  source: "feed" | "recon" | "lodgment" | "payment" | "manual";
};

export type BankLine = {
  id: string;
  ts: number;
  period: PeriodId;
  account: "Operating";
  amountAUD: number;
  description: string;
  status: "matched" | "unmatched" | "suggested";
  suggestedObligationId?: string;
};

export type EvidencePack = {
  id: string;
  ts: number;
  period: PeriodId;
  obligationId: string;
  manifestHash: string;
  items: {
    name: string;
    note: string;
  }[];
};

export type IncidentSeverity = "SEV-1" | "SEV-2" | "SEV-3";
export type IncidentStatus = "Open" | "Monitoring" | "Resolved";

export type Incident = {
  id: string;
  ts: number;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string;
  linkedObligationIds: string[];
};

export type DemoSettings = {
  wizardCompleted: boolean;

  orgName: string;
  abn: string;
  timeZone: string;

  reportingCadence: "Quarterly" | "Monthly";
  defaultPeriod: PeriodId;

  accounts: {
    operatingLabel: string;
    taxBufferLabel: string;
    trustLabel: string;
  };

  integrations: {
    bankFeed: { status: "Not connected" | "Connected (mock)"; provider: string };
    accounting: { status: "Not connected" | "Connected (mock)"; provider: string };
    payroll: { status: "Not connected" | "Connected (mock)"; provider: string };
  };

  notifications: {
    emailEnabled: boolean;
    webhookEnabled: boolean;
    webhookUrl: string;
  };

  security: {
    requireMfaForAdmin: boolean;
    sessionTimeoutMinutes: number;
    allowRegulatorPortal: boolean;
  };

  retention: {
    eventRetentionDays: number;
    evidenceRetentionDays: number;
  };

  exportDefaults: {
    includeTimeline: boolean;
    includePayloadSnapshots: boolean;
    includeControlAttestation: boolean;
  };

  analytics: {
    enabled: boolean;
    provider: "Demo (local)" | "PostHog (planned)" | "GA4 (planned)";
  };

  simulation: {
    enabled: boolean;
    intervalMs: number; // default: less frequent
    seed: number;
  };
};

export type DemoState = {
  period: PeriodId;
  events: DemoEvent[];
  obligations: Obligation[];
  ledger: LedgerEntry[];
  bankLines: BankLine[];
  evidencePacks: EvidencePack[];
  incidents: Incident[];
  settings: DemoSettings;
};

export function formatAUD(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
}

export function fmtTs(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString("en-AU", { hour12: true });
}

export function hashLike(input: string) {
  // Not cryptographic. Demo-only: stable-ish short hash.
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return "demo_" + (h >>> 0).toString(16).padStart(8, "0");
}

export function makeId(prefix: string) {
  return prefix + "_" + Math.random().toString(16).slice(2) + "_" + Math.random().toString(16).slice(2);
}

export function seededNext(seed: number) {
  // xorshift32
  let x = seed >>> 0;
  x ^= x << 13; x >>>= 0;
  x ^= x >> 17; x >>>= 0;
  x ^= x << 5;  x >>>= 0;
  return x >>> 0;
}

export function seededFloat01(seed: number) {
  const next = seededNext(seed);
  return { next, value: (next % 10000) / 10000 };
}

export function initialDemoState(): DemoState {
  const now = Date.now();
  const period: PeriodId = "2025-Q1";

  const obligations: Obligation[] = [
    {
      id: "obl_bas_q1",
      period,
      taxType: "BAS",
      label: "BAS (GST) - 2025-Q1",
      dueDate: "2025-04-28 (demo)",
      amountDueAUD: 28400,
      status: "Action required",
      stage: "Reconcile",
      fundedPct: 62,
      reconcileOpen: 3,
      hasDraftLodgment: false,
      lodged: false,
      paid: false,
      evidencePacks: 0,
      blockers: ["3 unmatched feed lines", "Policy attestation required"],
    },
    {
      id: "obl_paygw_q1",
      period,
      taxType: "PAYGW",
      label: "PAYGW Withholding - 2025-Q1",
      dueDate: "2025-04-28 (demo)",
      amountDueAUD: 19750,
      status: "OK",
      stage: "Fund",
      fundedPct: 88,
      reconcileOpen: 1,
      hasDraftLodgment: true,
      lodged: false,
      paid: false,
      evidencePacks: 1,
      blockers: ["1 feed line awaiting classification"],
    },
    {
      id: "obl_super_q1",
      period,
      taxType: "Super",
      label: "Super Guarantee - 2025-Q1",
      dueDate: "2025-04-28 (demo)",
      amountDueAUD: 14200,
      status: "OK",
      stage: "Lodge",
      fundedPct: 100,
      reconcileOpen: 0,
      hasDraftLodgment: true,
      lodged: false,
      paid: false,
      evidencePacks: 0,
      blockers: [],
    },
    {
      id: "obl_paygi_q1",
      period,
      taxType: "PAYGI",
      label: "PAYGI Instalment - 2025-Q1",
      dueDate: "2025-04-28 (demo)",
      amountDueAUD: 8600,
      status: "Overdue risk",
      stage: "Fund",
      fundedPct: 34,
      reconcileOpen: 0,
      hasDraftLodgment: false,
      lodged: false,
      paid: false,
      evidencePacks: 0,
      blockers: ["Funding shortfall forecast"],
    },
  ];

  const events: DemoEvent[] = [
    { id: makeId("ev"), ts: now - 1000 * 60 * 18, type: "feed.received", message: "Bank feed received (demo batch)", meta: { period } },
    { id: makeId("ev"), ts: now - 1000 * 60 * 17, type: "ledger.posted", message: "Ledger postings created from feed lines", meta: { period } },
    { id: makeId("ev"), ts: now - 1000 * 60 * 8, type: "recon.suggested", message: "Reconciliation suggestions generated", meta: { period } },
    { id: makeId("ev"), ts: now - 1000 * 60 * 3, type: "lodgment.prepared", message: "Draft lodgment prepared (PAYGW)", meta: { period, obligationId: "obl_paygw_q1" } },
  ];

  const ledger: LedgerEntry[] = [
    {
      id: makeId("led"),
      ts: now - 1000 * 60 * 17,
      period,
      obligationId: "obl_bas_q1",
      account: "Tax Buffer",
      direction: "credit",
      amountAUD: 9200,
      memo: "Tax buffer allocation (demo)",
      source: "feed",
    },
    {
      id: makeId("led"),
      ts: now - 1000 * 60 * 16,
      period,
      obligationId: "obl_paygw_q1",
      account: "Tax Buffer",
      direction: "credit",
      amountAUD: 7800,
      memo: "Tax buffer allocation (demo)",
      source: "feed",
    },
    {
      id: makeId("led"),
      ts: now - 1000 * 60 * 15,
      period,
      obligationId: "obl_super_q1",
      account: "Tax Buffer",
      direction: "credit",
      amountAUD: 5200,
      memo: "Tax buffer allocation (demo)",
      source: "feed",
    },
  ];

  const bankLines: BankLine[] = [
    {
      id: makeId("bnk"),
      ts: now - 1000 * 60 * 18,
      period,
      account: "Operating",
      amountAUD: -1240,
      description: "Supplier - inventory (demo)",
      status: "unmatched",
    },
    {
      id: makeId("bnk"),
      ts: now - 1000 * 60 * 18,
      period,
      account: "Operating",
      amountAUD: -860,
      description: "Payment gateway fees (demo)",
      status: "suggested",
      suggestedObligationId: "obl_bas_q1",
    },
  ];

  const evidencePacks: EvidencePack[] = [
    {
      id: "pack_paygw_q1_1",
      ts: now - 1000 * 60 * 14,
      period,
      obligationId: "obl_paygw_q1",
      manifestHash: hashLike("paygw_q1_pack_1"),
      items: [
        { name: "manifest.json", note: "Hashes + item list (demo)" },
        { name: "timeline.json", note: "Event timeline for period (demo)" },
        { name: "reconciliation-summary.json", note: "Reconciliation status snapshot (demo)" },
      ],
    },
  ];

  const incidents: Incident[] = [
    {
      id: "inc_1",
      ts: now - 1000 * 60 * 12,
      severity: "SEV-3",
      status: "Monitoring",
      title: "Feed classification backlog",
      description: "Unmatched and suggested bank lines require operator review (demo).",
      linkedObligationIds: ["obl_bas_q1"],
    },
  ];

  const settings: DemoSettings = {
    wizardCompleted: false,

    orgName: "Demo Org Pty Ltd",
    abn: "12 345 678 901 (demo)",
    timeZone: "Australia/Brisbane",

    reportingCadence: "Quarterly",
    defaultPeriod: period,

    accounts: {
      operatingLabel: "Operating (demo)",
      taxBufferLabel: "Tax Buffer (demo)",
      trustLabel: "Segregated Trust (demo)",
    },

    integrations: {
      bankFeed: { status: "Not connected", provider: "CBA (mock)" },
      accounting: { status: "Not connected", provider: "Xero (mock)" },
      payroll: { status: "Not connected", provider: "STP (mock)" },
    },

    notifications: {
      emailEnabled: false,
      webhookEnabled: false,
      webhookUrl: "",
    },

    security: {
      requireMfaForAdmin: true,
      sessionTimeoutMinutes: 30,
      allowRegulatorPortal: true,
    },

    retention: {
      eventRetentionDays: 365,
      evidenceRetentionDays: 2555,
    },

    exportDefaults: {
      includeTimeline: true,
      includePayloadSnapshots: true,
      includeControlAttestation: true,
    },

    analytics: {
      enabled: true,
      provider: "Demo (local)",
    },

    simulation: {
      enabled: false,
      intervalMs: 60000, // less often by default
      seed: 1337,
    },
  };

  return {
    period,
    events,
    obligations,
    ledger,
    bankLines,
    evidencePacks,
    incidents,
    settings,
  };
}
