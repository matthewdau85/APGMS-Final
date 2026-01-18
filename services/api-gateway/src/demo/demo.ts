import type { DemoEvent, DemoState, BankLine, Obligation, LedgerEntry, EvidencePack, Incident } from "./types.js";
import { checksumToy, id, makeRng, nowIso, pick, ymd } from "./types.js";
import type { CaseStudyId } from "./case-studies.js";
import { CASE_STUDIES, seedCaseStudy } from "./case-studies.js";

type OrgRuntime = {
  state: DemoState;
  sim?: {
    timers: NodeJS.Timeout[];
    rng: () => number;
  };
};

const ORGS: Map<string, OrgRuntime> = new Map();

export function listCaseStudies() {
  return CASE_STUDIES;
}

export function getState(orgId: string): DemoState | null {
  const rt = ORGS.get(orgId);
  return rt ? rt.state : null;
}

export function seed(orgId: string, caseId: CaseStudyId, seedStr: string, nowTs: number): DemoState {
  const state = seedCaseStudy(caseId, orgId, seedStr, nowTs);
  ORGS.set(orgId, { state });
  return state;
}

export function appendEvent(orgId: string, evt: Omit<DemoEvent, "id">): DemoEvent {
  const rt = ORGS.get(orgId);
  if (!rt) throw new Error("demo_org_not_seeded");
  const full: DemoEvent = { ...evt, id: id("evt", evt.ts, rt.state.events.length + 1) };
  rt.state.events.push(full);
  return full;
}

export function eventsSince(orgId: string, afterTs: number): DemoEvent[] {
  const rt = ORGS.get(orgId);
  if (!rt) return [];
  return rt.state.events.filter((e) => e.ts > afterTs);
}

function pushBankLine(orgId: string, line: BankLine, evtMsg: string) {
  const rt = ORGS.get(orgId);
  if (!rt) throw new Error("demo_org_not_seeded");
  rt.state.bankLines.unshift(line);
  appendEvent(orgId, {
    ts: line.ts,
    type: "CONNECTOR_IN_BANK",
    orgId,
    message: evtMsg,
    data: { bankLineId: line.id, amountCents: line.amountCents, description: line.description },
  });
}

function pushLedger(orgId: string, entry: LedgerEntry, evtMsg: string) {
  const rt = ORGS.get(orgId);
  if (!rt) throw new Error("demo_org_not_seeded");
  rt.state.ledger.unshift(entry);
  appendEvent(orgId, {
    ts: entry.ts,
    type: "LEDGER_POSTED",
    orgId,
    message: evtMsg,
    data: { ledgerId: entry.id, amountCents: entry.amountCents, memo: entry.memo, account: entry.account },
  });
}

function updateObligation(orgId: string, obligationId: string, patch: Partial<Obligation>, msg: string) {
  const rt = ORGS.get(orgId);
  if (!rt) throw new Error("demo_org_not_seeded");
  const idx = rt.state.obligations.findIndex((o) => o.id === obligationId);
  if (idx < 0) throw new Error("demo_obligation_not_found");
  rt.state.obligations[idx] = { ...rt.state.obligations[idx], ...patch };
  appendEvent(orgId, {
    ts: Date.now(),
    type: "OBLIGATION_UPDATED",
    orgId,
    period: rt.state.obligations[idx].period,
    message: msg,
    data: { obligationId, patch },
  });
}

export function runReconciliation(orgId: string, obligationId: string) {
  const rt = ORGS.get(orgId);
  if (!rt) throw new Error("demo_org_not_seeded");

  // Demo reconciliation logic: mark a few bank lines as reconciled and clear blockers.
  const lines = rt.state.bankLines.filter((b) => b.status === "unreconciled").slice(0, 2);
  for (const l of lines) {
    l.status = "reconciled";
    l.resolvedAs = l.amountCents >= 0 ? "business" : "tax";
  }

  updateObligation(orgId, obligationId, { status: "funded", blockers: [] }, "Reconciliation completed (demo)");
  appendEvent(orgId, {
    ts: Date.now(),
    type: "RECONCILIATION_RUN",
    orgId,
    message: `Reconciliation run for ${obligationId} (demo)`,
    data: { obligationId, reconciledBankLineIds: lines.map((l) => l.id) },
  });
}

export function prepareLodgment(orgId: string, obligationId: string) {
  updateObligation(orgId, obligationId, { status: "ready_to_lodge", blockers: [] }, "Lodgment prepared (demo)");
  appendEvent(orgId, { ts: Date.now(), type: "LODGE_PREPARED", orgId, message: `Prepared lodgment for ${obligationId} (demo)` });
}

export function submitLodgment(orgId: string, obligationId: string) {
  updateObligation(orgId, obligationId, { status: "lodged", blockers: [] }, "Lodgment submitted (demo)");
  appendEvent(orgId, { ts: Date.now(), type: "LODGE_SUBMITTED", orgId, message: `Submitted lodgment for ${obligationId} (demo)` });
}

export function generateEvidencePack(orgId: string, obligationId: string) {
  const rt = ORGS.get(orgId);
  if (!rt) throw new Error("demo_org_not_seeded");
  const ob = rt.state.obligations.find((o) => o.id === obligationId);
  if (!ob) throw new Error("demo_obligation_not_found");

  const ts = Date.now();
  const checksum = checksumToy(`${orgId}|${obligationId}|${ob.period}|${nowIso(ts)}`);

  const pack: EvidencePack = {
    id: id("ep", ts, rt.state.evidencePacks.length + 1),
    orgId,
    ts,
    obligationId,
    period: ob.period,
    checksum,
    scope: "obligation",
  };

  rt.state.evidencePacks.unshift(pack);

  appendEvent(orgId, {
    ts,
    type: "EVIDENCE_PACK_GENERATED",
    orgId,
    period: ob.period,
    message: `Evidence pack generated for ${obligationId} (demo)`,
    data: { evidencePackId: pack.id, checksum },
  });

  return pack;
}

export function createIncident(orgId: string, payload: { title: string; severity: Incident["severity"]; description: string; obligationIds: string[] }) {
  const rt = ORGS.get(orgId);
  if (!rt) throw new Error("demo_org_not_seeded");
  const ts = Date.now();
  const inc: Incident = {
    id: id("inc", ts, rt.state.incidents.length + 1),
    orgId,
    ts,
    title: payload.title,
    severity: payload.severity,
    description: payload.description,
    obligationIds: payload.obligationIds,
    status: "open",
  };
  rt.state.incidents.unshift(inc);
  appendEvent(orgId, { ts, type: "INCIDENT_CREATED", orgId, message: `Incident created: ${inc.title} (demo)`, data: { incidentId: inc.id } });
  return inc;
}

export function startSimulation(orgId: string) {
  const rt = ORGS.get(orgId);
  if (!rt) throw new Error("demo_org_not_seeded");
  if (rt.sim) return; // already running

  const seedStr = rt.state.settings.simulation.seed || `seed_${orgId}`;
  const rng = makeRng(seedStr);
  const timers: NodeJS.Timeout[] = [];

  // Bank feed: frequent
  const bankEveryMs = Math.max(10, rt.state.settings.simulation.feedIntervalSeconds) * 1000;
  timers.push(
    setInterval(() => {
      const ts = Date.now();
      const desc = pick(rng, ["Square settlement", "Tyro settlement", "Stripe payout", "Supplier invoice", "Rent", "Merchant fees"]);
      const isInflow = rng() > 0.35;
      const magnitude = isInflow ? 80000 + Math.floor(rng() * 900000) : 60000 + Math.floor(rng() * 1200000);
      const amountCents = isInflow ? magnitude : -magnitude;

      pushBankLine(orgId, {
        id: id("bl", ts, Math.floor((ts % 1000) + 1)),
        orgId,
        ts,
        postedDate: ymd(ts),
        description: desc,
        amountCents,
        status: "unreconciled",
      }, `Bank feed: ${desc} (${amountCents >= 0 ? "+" : ""}${amountCents}c)`);

      // Basic ledger mirroring
      pushLedger(orgId, {
        id: id("led", ts, Math.floor((ts % 1000) + 1)),
        orgId,
        ts,
        postedDate: ymd(ts),
        account: "operating",
        direction: amountCents >= 0 ? "credit" : "debit",
        amountCents: Math.abs(amountCents),
        memo: `Auto-posted from bank feed: ${desc}`,
        ref: `bank:${ts}`,
      }, `Ledger auto-posted from bank line (${desc})`);
    }, bankEveryMs),
  );

  // Payroll inbound: slower
  timers.push(
    setInterval(() => {
      const ts = Date.now();
      appendEvent(orgId, {
        ts,
        type: "CONNECTOR_IN_PAYROLL",
        orgId,
        message: "Payroll sync inbound (demo): new payslip batch detected",
        data: { batchId: id("pay", ts, 1), employees: 7 + Math.floor(rng() * 18) },
      });
    }, 5 * 60 * 1000),
  );

  // Accounting inbound: slower
  timers.push(
    setInterval(() => {
      const ts = Date.now();
      appendEvent(orgId, {
        ts,
        type: "CONNECTOR_IN_ACCOUNTING",
        orgId,
        message: "Accounting sync inbound (demo): invoices/expenses refreshed",
        data: { syncId: id("acc", ts, 1), invoices: 3 + Math.floor(rng() * 12), expenses: 4 + Math.floor(rng() * 20) },
      });
    }, 7 * 60 * 1000),
  );

  rt.sim = { timers, rng };
  rt.state.settings.simulation.enabled = true;
  appendEvent(orgId, { ts: Date.now(), type: "SIM_STARTED", orgId, message: "Simulation started (demo)" });
}

export function stopSimulation(orgId: string) {
  const rt = ORGS.get(orgId);
  if (!rt || !rt.sim) return;
  for (const t of rt.sim.timers) clearInterval(t);
  rt.sim = undefined;
  rt.state.settings.simulation.enabled = false;
  appendEvent(orgId, { ts: Date.now(), type: "SIM_STOPPED", orgId, message: "Simulation stopped (demo)" });
}
