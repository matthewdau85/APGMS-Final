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
