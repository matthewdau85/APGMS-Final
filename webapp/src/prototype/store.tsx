import React, { createContext, useContext, useMemo, useState } from "react";
import {
  type MockState,
  createInitialMockState,
  simpleChecksum,
  type Period,
  type ObligationStatus,
} from "./mockData";

type PrototypeActions = {
  setPeriod: (p: Period) => void;
  ingestFeeds: () => void;

  lodgeObligation: (id: string) => void;
  markPaid: (id: string) => void;
  setObligationStatus: (id: string, status: ObligationStatus) => void;

  runReconciliation: () => void;

  generateEvidencePack: () => void;

  createIncident: (title: string, severity: "SEV-1" | "SEV-2" | "SEV-3") => void;
  mitigateIncident: (id: string) => void;
  closeIncident: (id: string) => void;

  toggleRegulatorMode: () => void;
};

type PrototypeContextValue = {
  state: MockState;
  actions: PrototypeActions;
};

const PrototypeContext = createContext<PrototypeContextValue | null>(null);

function nowIso() {
  return new Date().toISOString();
}

function nextId(prefix: string) {
  const n = Math.floor(Math.random() * 900000) + 100000;
  return `${prefix}_${n}`;
}

export function PrototypeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MockState>(() => createInitialMockState());

  const actions = useMemo<PrototypeActions>(() => {
    return {
      setPeriod: (p) => setState((s) => ({ ...s, currentPeriod: p })),

      ingestFeeds: () =>
        setState((s) => ({
          ...s,
          feeds: {
            ...s.feeds,
            lastIngestAt: nowIso(),
            items: [
              { id: nextId("fd"), ts: nowIso(), source: "Bank", kind: "Transactions", status: "ok" },
              { id: nextId("fd"), ts: nowIso(), source: "Payroll", kind: "Payrun", status: "ok" },
              { id: nextId("fd"), ts: nowIso(), source: "POS", kind: "Sales", status: Math.random() < 0.2 ? "warn" : "ok" },
              ...s.feeds.items,
            ].slice(0, 12),
          },
        })),

      lodgeObligation: (id) =>
        setState((s) => ({
          ...s,
          obligations: s.obligations.map((o) =>
            o.id === id ? { ...o, status: "lodged", lastUpdated: nowIso() } : o
          ),
        })),

      markPaid: (id) =>
        setState((s) => ({
          ...s,
          obligations: s.obligations.map((o) =>
            o.id === id ? { ...o, status: "paid", fundedCents: o.amountDueCents, lastUpdated: nowIso() } : o
          ),
        })),

      setObligationStatus: (id, status) =>
        setState((s) => ({
          ...s,
          obligations: s.obligations.map((o) => (o.id === id ? { ...o, status, lastUpdated: nowIso() } : o)),
        })),

      runReconciliation: () =>
        setState((s) => {
          const unmatched = Math.max(0, Math.floor(Math.random() * 6));
          const matched = 18 + Math.floor(Math.random() * 10);
          return {
            ...s,
            reconciliation: {
              lastRunAt: nowIso(),
              unmatchedCount: unmatched,
              matchedCount: matched,
              notes: unmatched === 0 ? "All items matched (mock)." : "Some items require review (mock).",
            },
          };
        }),

      generateEvidencePack: () =>
        setState((s) => {
          const period = s.currentPeriod;
          const snapshot = JSON.stringify({
            period,
            obligations: s.obligations.filter((o) => o.period === period),
            ledgerCount: s.ledger.length,
            controls: s.controls,
            incidentsOpen: s.incidents.filter((i) => i.status !== "closed").length,
          });
          const checksum = simpleChecksum(snapshot);

          const epk = {
            id: nextId("epk"),
            period,
            createdAt: nowIso(),
            manifestLines: [
              "manifest_version: 1",
              `period: ${period}`,
              `created_at: ${nowIso()}`,
              `snapshot_checksum: ${checksum}`,
              "item: obligations_snapshot.json checksum: demo-" + checksum.slice(0, 4),
              "item: ledger_snapshot.json checksum: demo-" + checksum.slice(4, 8),
              "item: controls_snapshot.json checksum: demo-" + checksum.slice(0, 4),
              "item: incidents_snapshot.json checksum: demo-" + checksum.slice(4, 8),
            ],
          };

          return { ...s, evidencePacks: [epk, ...s.evidencePacks] };
        }),

      createIncident: (title, severity) =>
        setState((s) => ({
          ...s,
          incidents: [
            {
              id: nextId("inc"),
              openedAt: nowIso(),
              severity,
              title,
              status: "open",
              owner: "Admin",
              notes: "Created in prototype (mock).",
            },
            ...s.incidents,
          ],
        })),

      mitigateIncident: (id) =>
        setState((s) => ({
          ...s,
          incidents: s.incidents.map((i) => (i.id === id ? { ...i, status: "mitigated" } : i)),
        })),

      closeIncident: (id) =>
        setState((s) => ({
          ...s,
          incidents: s.incidents.map((i) => (i.id === id ? { ...i, status: "closed" } : i)),
        })),

      toggleRegulatorMode: () =>
        setState((s) => ({
          ...s,
          settings: { ...s.settings, regulatorMode: !s.settings.regulatorMode },
        })),
    };
  }, []);

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return <PrototypeContext.Provider value={value}>{children}</PrototypeContext.Provider>;
}

export function usePrototype() {
  const ctx = useContext(PrototypeContext);
  if (!ctx) throw new Error("usePrototype must be used within PrototypeProvider");
  return ctx;
}
