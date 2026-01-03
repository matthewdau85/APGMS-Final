import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  type BankLine,
  type DemoEvent,
  type DemoState,
  type EvidencePack,
  type Incident,
  type LedgerEntry,
  type Obligation,
  type PeriodId,
  formatAUD,
  fmtTs,
  hashLike,
  initialDemoState,
  makeId,
  seededFloat01,
} from "./mockData";
import { resetAnalytics, track } from "./analytics";

const STORAGE_KEY = "apgms_prototype_state_v1";

function safeParse(raw: string): DemoState | null {
  try {
    const obj = JSON.parse(raw) as DemoState;
    if (!obj || typeof obj !== "object") return null;
    if (!obj.period) return null;
    if (!Array.isArray(obj.events)) return null;
    if (!Array.isArray(obj.obligations)) return null;
    if (!Array.isArray(obj.ledger)) return null;
    if (!Array.isArray(obj.bankLines)) return null;
    if (!Array.isArray(obj.evidencePacks)) return null;
    if (!Array.isArray(obj.incidents)) return null;
    if (!obj.settings) return null;
    return obj;
  } catch {
    return null;
  }
}

function loadState(): DemoState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return initialDemoState();
  const parsed = safeParse(raw);
  return parsed ?? initialDemoState();
}

function saveState(s: DemoState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

type PrototypeContextValue = {
  state: DemoState;

  setPeriod: (p: PeriodId) => void;

  toggleSimulation: (enabled: boolean) => void;
  setSimulationIntervalMs: (ms: number) => void;

  resetDemo: () => void;

  // Workflow actions
  runReconciliation: (obligationId: string) => void;
  prepareLodgment: (obligationId: string) => void;
  submitLodgmentDemo: (obligationId: string) => void;
  queuePaymentDemo: (obligationId: string) => void;
  generateEvidencePack: (obligationId: string) => void;

  createIncident: (partial: { severity: Incident["severity"]; title: string; description: string; linkedObligationIds: string[] }) => void;
  updateSettings: (patch: Partial<DemoState["settings"]>) => void;
};

const PrototypeContext = createContext<PrototypeContextValue | null>(null);

function pushEvent(s: DemoState, e: DemoEvent): DemoState {
  const next = { ...s, events: [e, ...s.events].slice(0, 200) };
  return next;
}

function updateObligation(s: DemoState, id: string, patch: Partial<Obligation>) {
  return {
    ...s,
    obligations: s.obligations.map((o) => (o.id === id ? { ...o, ...patch } : o)),
  };
}

function addLedger(s: DemoState, entry: LedgerEntry): DemoState {
  return { ...s, ledger: [entry, ...s.ledger].slice(0, 500) };
}

function addBankLine(s: DemoState, line: BankLine): DemoState {
  return { ...s, bankLines: [line, ...s.bankLines].slice(0, 500) };
}

function addIncident(s: DemoState, inc: Incident): DemoState {
  return { ...s, incidents: [inc, ...s.incidents].slice(0, 200) };
}

function addEvidencePack(s: DemoState, pack: EvidencePack): DemoState {
  return { ...s, evidencePacks: [pack, ...s.evidencePacks].slice(0, 200) };
}

function computeFundingForecastPct(s: DemoState, obligation: Obligation) {
  // Demo heuristic:
  // - Current fundedPct as baseline
  // - Use simulation interval to project incremental funding by due date.
  // - Assume each feed tick increases fundedPct by 1-6 points on average, bounded to 100.
  const intervalMs = s.settings.simulation.intervalMs || 60000;
  const ticksPerDay = Math.max(1, Math.floor((24 * 60 * 60 * 1000) / intervalMs));
  const projectedDays = 5; // demo window
  const projectedTicks = ticksPerDay * projectedDays;
  const projectedGain = Math.min(30, Math.floor(projectedTicks * 2)); // cap
  return Math.min(100, obligation.fundedPct + projectedGain);
}

export function PrototypeProvider(props: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoState>(() => {
    if (typeof window === "undefined") return initialDemoState();
    return loadState();
  });

  const simTimer = useRef<number | null>(null);

  // Persist state
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Simulation loop (less frequent by default)
  useEffect(() => {
    if (!state.settings.simulation.enabled) {
      if (simTimer.current) {
        window.clearInterval(simTimer.current);
        simTimer.current = null;
      }
      return;
    }

    if (simTimer.current) window.clearInterval(simTimer.current);

    simTimer.current = window.setInterval(() => {
      setState((prev) => {
        const now = Date.now();
        const period = prev.period;

        // seeded randomness (deterministic behavior)
        const seed0 = prev.settings.simulation.seed >>> 0;
        const step = (prev.events.length + prev.ledger.length + prev.bankLines.length) >>> 0;
        const seed = (seed0 ^ step) >>> 0;

        const r1 = seededFloat01(seed);
        const r2 = seededFloat01(r1.next);
        const r3 = seededFloat01(r2.next);

        const ob = prev.obligations.filter((o) => o.period === period)[Math.floor(r1.value * Math.max(1, prev.obligations.filter((o) => o.period === period).length))] ?? prev.obligations[0];
        const amount = Math.round((400 + r2.value * 2200) / 10) * 10;
        const isUnmatched = r3.value < 0.22;

        let next = prev;

        // Bank feed received
        next = pushEvent(next, {
          id: makeId("ev"),
          ts: now,
          type: "feed.received",
          message: "Bank feed received (simulated)",
          meta: { period, amountAUD: amount, unmatched: isUnmatched },
        });

        const line: BankLine = {
          id: makeId("bnk"),
          ts: now,
          period,
          account: "Operating",
          amountAUD: -amount,
          description: isUnmatched ? "Card payment - requires classification (simulated)" : "Transfer - tax allocation (simulated)",
          status: isUnmatched ? "unmatched" : "suggested",
          suggestedObligationId: isUnmatched ? undefined : ob.id,
        };
        next = addBankLine(next, line);

        // Ledger posting (simulate allocation)
        if (!isUnmatched) {
          const led: LedgerEntry = {
            id: makeId("led"),
            ts: now + 1000,
            period,
            obligationId: ob.id,
            account: "Tax Buffer",
            direction: "credit",
            amountAUD: amount,
            memo: "Tax buffer allocation (simulated)",
            source: "feed",
          };
          next = addLedger(next, led);
          next = pushEvent(next, {
            id: makeId("ev"),
            ts: now + 1000,
            type: "ledger.posted",
            message: "Ledger posted from feed line",
            meta: { period, obligationId: ob.id, amountAUD: amount },
          });

          // Reconciliation suggestion event
          next = pushEvent(next, {
            id: makeId("ev"),
            ts: now + 1500,
            type: "recon.suggested",
            message: "Match suggestion created",
            meta: { period, obligationId: ob.id, bankLineId: line.id },
          });

          // Increase funded percent slightly
          const gain = 1 + Math.floor(r2.value * 6);
          const updated = next.obligations.find((x) => x.id === ob.id);
          if (updated) {
            const projected = computeFundingForecastPct(next, updated);
            next = updateObligation(next, ob.id, {
              fundedPct: Math.min(100, updated.fundedPct + gain),
              status: projected >= 90 ? "OK" : updated.status,
            });
          }

          track("sim.feed_to_ledger", { obligationId: ob.id, amountAUD: amount, period });
        } else {
          // Occasionally open an incident when unmatched lines accumulate
          const openUnmatched = next.bankLines.filter((b) => b.period === period && b.status === "unmatched").length;
          if (openUnmatched >= 4) {
            const inc: Incident = {
              id: makeId("inc"),
              ts: now + 2000,
              severity: "SEV-3",
              status: "Open",
              title: "Feed classification backlog (simulated)",
              description: "Unmatched feed lines require operator classification before lodgment gates can clear.",
              linkedObligationIds: [],
            };
            next = addIncident(next, inc);
            next = pushEvent(next, {
              id: makeId("ev"),
              ts: now + 2000,
              type: "incident.created",
              message: "Incident created: Feed classification backlog",
              meta: { period, incidentId: inc.id },
            });
            track("sim.incident_created", { incidentId: inc.id, period });
          }
        }

        return next;
      });
    }, Math.max(15000, state.settings.simulation.intervalMs)); // hard lower bound
    return () => {
      if (simTimer.current) {
        window.clearInterval(simTimer.current);
        simTimer.current = null;
      }
    };
  }, [state.settings.simulation.enabled, state.settings.simulation.intervalMs, state.settings.simulation.seed]);

  const api = useMemo<PrototypeContextValue>(() => {
    return {
      state,

      setPeriod: (p: PeriodId) => {
        setState((prev) => {
          track("ui.period_set", { period: p });
          return { ...prev, period: p };
        });
      },

      toggleSimulation: (enabled: boolean) => {
        setState((prev) => {
          track("ui.simulation_toggle", { enabled });
          return { ...prev, settings: { ...prev.settings, simulation: { ...prev.settings.simulation, enabled } } };
        });
      },

      setSimulationIntervalMs: (ms: number) => {
        setState((prev) => {
          track("ui.simulation_interval", { ms });
          return { ...prev, settings: { ...prev.settings, simulation: { ...prev.settings.simulation, intervalMs: ms } } };
        });
      },

      resetDemo: () => {
        setState(() => {
          resetAnalytics();
          const next = initialDemoState();
          next.settings.wizardCompleted = false;
          track("demo.reset", {});
          return pushEvent(next, { id: makeId("ev"), ts: Date.now(), type: "demo.reset", message: "Demo state reset", meta: {} });
        });
      },

      runReconciliation: (obligationId: string) => {
        setState((prev) => {
          const now = Date.now();
          let next = prev;
          const open = prev.bankLines.filter((b) => b.period === prev.period && (b.status === "unmatched" || b.status === "suggested")).length;
          next = pushEvent(next, {
            id: makeId("ev"),
            ts: now,
            type: "recon.completed",
            message: "Reconciliation run completed (demo)",
            meta: { period: prev.period, openItems: open, obligationId },
          });
          next = updateObligation(next, obligationId, {
            reconcileOpen: Math.max(0, open - 1),
            stage: open > 1 ? "Reconcile" : "Lodge",
            blockers: open > 1 ? ["Unmatched feed items remain"] : [],
            status: open > 1 ? "Action required" : "OK",
          });
          track("workflow.recon_run", { period: prev.period, obligationId, openItems: open });
          return next;
        });
      },

      prepareLodgment: (obligationId: string) => {
        setState((prev) => {
          const now = Date.now();
          let next = prev;
          next = pushEvent(next, {
            id: makeId("ev"),
            ts: now,
            type: "lodgment.prepared",
            message: "Lodgment prepared (demo)",
            meta: { period: prev.period, obligationId },
          });
          next = updateObligation(next, obligationId, { hasDraftLodgment: true, stage: "Lodge" });
          track("workflow.lodgment_prepared", { period: prev.period, obligationId });
          return next;
        });
      },

      submitLodgmentDemo: (obligationId: string) => {
        setState((prev) => {
          const now = Date.now();
          let next = prev;
          next = pushEvent(next, {
            id: makeId("ev"),
            ts: now,
            type: "lodgment.submitted",
            message: "Lodgment submitted (demo)",
            meta: { period: prev.period, obligationId, receipt: hashLike(obligationId + ":" + now) },
          });
          next = updateObligation(next, obligationId, { lodged: true, stage: "Pay", blockers: [] });
          track("workflow.lodgment_submitted", { period: prev.period, obligationId });
          return next;
        });
      },

      queuePaymentDemo: (obligationId: string) => {
        setState((prev) => {
          const now = Date.now();
          let next = prev;
          next = pushEvent(next, {
            id: makeId("ev"),
            ts: now,
            type: "payment.queued",
            message: "Payment instruction queued (demo)",
            meta: { period: prev.period, obligationId },
          });

          // Ledger debit from Tax Buffer
          const ob = prev.obligations.find((o) => o.id === obligationId);
          if (ob) {
            next = addLedger(next, {
              id: makeId("led"),
              ts: now + 500,
              period: prev.period,
              obligationId,
              account: "Tax Buffer",
              direction: "debit",
              amountAUD: Math.min(ob.amountDueAUD, Math.round(ob.amountDueAUD * 0.95)),
              memo: "Payment instruction (demo)",
              source: "payment",
            });
          }

          next = updateObligation(next, obligationId, { paid: true, stage: "Evidence" });
          track("workflow.payment_queued", { period: prev.period, obligationId });
          return next;
        });
      },

      generateEvidencePack: (obligationId: string) => {
        setState((prev) => {
          const now = Date.now();
          const period = prev.period;
          const manifestHash = hashLike("pack:" + obligationId + ":" + period + ":" + now);

          const pack: EvidencePack = {
            id: makeId("pack"),
            ts: now,
            period,
            obligationId,
            manifestHash,
            items: [
              { name: "manifest.json", note: "Hashes + item inventory (demo)" },
              { name: "timeline.json", note: "Event timeline for period (demo)" },
              { name: "lodgment-payload.json", note: "Lodgment payload snapshot (demo)" },
              { name: "reconciliation-summary.json", note: "Reconciliation summary (demo)" },
              { name: "controls-attestation.json", note: "Control attestation snapshot (demo)" },
            ],
          };

          let next = prev;
          next = addEvidencePack(next, pack);
          next = pushEvent(next, {
            id: makeId("ev"),
            ts: now,
            type: "evidence.generated",
            message: "Evidence pack generated (demo)",
            meta: { period, obligationId, manifestHash },
          });

          const ob = prev.obligations.find((o) => o.id === obligationId);
          if (ob) {
            next = updateObligation(next, obligationId, { evidencePacks: ob.evidencePacks + 1, stage: "Evidence", status: "OK" });
          }

          track("workflow.evidence_generated", { period, obligationId, manifestHash });
          return next;
        });
      },

      createIncident: (partial) => {
        setState((prev) => {
          const now = Date.now();
          const inc: Incident = {
            id: makeId("inc"),
            ts: now,
            severity: partial.severity,
            status: "Open",
            title: partial.title,
            description: partial.description,
            linkedObligationIds: partial.linkedObligationIds,
          };

          let next = prev;
          next = addIncident(next, inc);
          next = pushEvent(next, {
            id: makeId("ev"),
            ts: now,
            type: "incident.created",
            message: "Incident created: " + partial.title,
            meta: { period: prev.period, incidentId: inc.id },
          });

          track("ops.incident_created", { period: prev.period, incidentId: inc.id, severity: inc.severity });
          return next;
        });
      },

      updateSettings: (patch) => {
        setState((prev) => {
          const next = { ...prev, settings: { ...prev.settings, ...patch } };
          track("ui.settings_updated", { keys: Object.keys(patch) });
          return next;
        });
      },
    };
  }, [state]);

  return <PrototypeContext.Provider value={api}>{props.children}</PrototypeContext.Provider>;
}

export function usePrototype() {
  const ctx = useContext(PrototypeContext);
  if (!ctx) throw new Error("usePrototype must be used inside PrototypeProvider");
  return ctx;
}

export function computeDashboardSignals(s: DemoState) {
  const period = s.period;
  const obs = s.obligations.filter((o) => o.period === period);

  const fundedAvg = obs.length ? Math.round(obs.reduce((a, o) => a + o.fundedPct, 0) / obs.length) : 0;
  const reconcilePending = obs.reduce((a, o) => a + o.reconcileOpen, 0);
  const readyToLodge = obs.filter((o) => o.stage === "Lodge" && o.hasDraftLodgment && o.reconcileOpen === 0).length;
  const overdueRisk = obs.filter((o) => o.status === "Overdue risk").length;

  const recentEvents = s.events.slice(0, 8);

  // Predictive demo heuristics
  const forecast = obs.map((o) => {
    const projectedFunding = (function () {
      const intervalMs = s.settings.simulation.intervalMs || 60000;
      const ticksPerDay = Math.max(1, Math.floor((24 * 60 * 60 * 1000) / intervalMs));
      const projectedTicks = ticksPerDay * 5;
      const projectedGain = Math.min(30, Math.floor(projectedTicks * 2));
      return Math.min(100, o.fundedPct + projectedGain);
    })();

    const likelihoodToLodge = Math.max(
      10,
      Math.min(
        95,
        Math.round(
          (projectedFunding * 0.55) +
            (o.reconcileOpen === 0 ? 25 : 8) +
            (o.hasDraftLodgment ? 12 : 4) -
            (o.status === "Overdue risk" ? 18 : 0)
        )
      )
    );

    return { obligationId: o.id, label: o.label, projectedFundingPct: projectedFunding, lodgeLikelihoodPct: likelihoodToLodge };
  });

  return {
    fundedAvgPct: fundedAvg,
    reconcilePending,
    readyToLodge,
    overdueRisk,
    recentEvents,
    forecast,
  };
}

export function describeAmount(n: number) {
  return formatAUD(n);
}

export function describeTs(ts: number) {
  return fmtTs(ts);
}
