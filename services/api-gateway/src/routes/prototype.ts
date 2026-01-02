import type { FastifyPluginAsync } from "fastify";
import { requireAdmin } from "../plugins/auth.js";

function isoNow() {
  return new Date().toISOString();
}

function mockOverview(period: string, orgId: string | null) {
  return {
    ok: true,
    mode: "prototype",
    orgId,
    period,
    generatedAt: isoNow(),
    kpis: [
      { label: "Obligations due", value: 3, status: "amber" },
      { label: "Overdue", value: 0, status: "green" },
      { label: "Unreconciled items", value: 12, status: "amber" },
      { label: "Controls", value: "92%", status: "green" },
    ],
    timeline: [
      { at: "2025-01-05", type: "feed.bank.import", detail: "Imported 42 bank txns" },
      { at: "2025-01-10", type: "feed.payroll.import", detail: "Imported 8 payroll events" },
      { at: "2025-01-18", type: "recon.run", detail: "Matched 30 items automatically" },
      { at: "2025-01-20", type: "lodgment.bas.draft", detail: "Draft BAS created" },
    ],
  };
}

function mockObligations(period: string) {
  return {
    ok: true,
    period,
    obligations: [
      {
        id: "obl_bas_001",
        type: "BAS",
        dueDate: "2025-02-28",
        status: "not_started",
        risk: "low",
        notes: "Mock BAS obligation for prototype.",
      },
      {
        id: "obl_paygw_001",
        type: "PAYGW",
        dueDate: "2025-01-21",
        status: "in_progress",
        risk: "medium",
        notes: "Mock PAYGW obligation.",
      },
      {
        id: "obl_super_001",
        type: "Super",
        dueDate: "2025-01-28",
        status: "ready_to_lodge",
        risk: "low",
        notes: "Mock Super obligation.",
      },
    ],
  };
}

function mockBankFeed(period: string) {
  return {
    ok: true,
    period,
    feed: "bank",
    transactions: Array.from({ length: 18 }).map((_, i) => ({
      id: `bnk_${i + 1}`,
      at: `2025-01-${String((i % 20) + 1).padStart(2, "0")}T10:15:00Z`,
      description: i % 3 === 0 ? "ATO - BPAY Payment" : i % 3 === 1 ? "Officeworks" : "Client Payment",
      amount: i % 3 === 0 ? -420.55 : i % 3 === 1 ? -89.99 : 1200.0,
      status: i % 4 === 0 ? "flagged" : i % 4 === 1 ? "unreconciled" : "reconciled",
    })),
  };
}

function mockPayrollFeed(period: string) {
  return {
    ok: true,
    period,
    feed: "payroll",
    events: Array.from({ length: 8 }).map((_, i) => ({
      id: `pay_${i + 1}`,
      payDate: `2025-01-${String((i * 3) + 2).padStart(2, "0")}`,
      gross: 3200 + i * 50,
      taxWithheld: 780 + i * 10,
      super: 352 + i * 5,
      status: i % 3 === 0 ? "imported" : i % 3 === 1 ? "matched" : "review",
    })),
  };
}

const routes: FastifyPluginAsync = async (app) => {
  // Entire prototype surface is admin-only.
  app.addHook("preHandler", requireAdmin);

  app.get("/overview", async (req) => {
    const period = (req.query as any)?.period?.toString() ?? "";
    if (!period) return { ok: false, error: "missing_period" };

    const orgId = (req.headers["x-org-id"] ?? "").toString() || null;
    return mockOverview(period, orgId);
  });

  app.get("/obligations", async (req) => {
    const period = (req.query as any)?.period?.toString() ?? "";
    if (!period) return { ok: false, error: "missing_period" };
    return mockObligations(period);
  });

  app.get("/feeds/bank", async (req) => {
    const period = (req.query as any)?.period?.toString() ?? "";
    if (!period) return { ok: false, error: "missing_period" };
    return mockBankFeed(period);
  });

  app.get("/feeds/payroll", async (req) => {
    const period = (req.query as any)?.period?.toString() ?? "";
    if (!period) return { ok: false, error: "missing_period" };
    return mockPayrollFeed(period);
  });

  app.post("/lodgments/bas", async (req) => {
    const body = (req.body ?? {}) as any;
    const period = (body.period ?? "").toString();
    if (!period) return { ok: false, error: "missing_period" };

    return {
      ok: true,
      submittedAt: isoNow(),
      lodgment: {
        id: `lodg_bas_${Math.random().toString(16).slice(2, 10)}`,
        type: "BAS",
        period,
        status: "accepted_mock",
        receipt: `R-${Date.now()}`,
      },
    };
  });

  app.post("/evidence-pack/generate", async (req) => {
    const body = (req.body ?? {}) as any;
    const period = (body.period ?? "").toString();
    if (!period) return { ok: false, error: "missing_period" };

    const packId = `pack_${Math.random().toString(16).slice(2, 10)}`;
    return {
      ok: true,
      packId,
      period,
      generatedAt: isoNow(),
      files: [
        { path: "manifest.json", sha256: "mock-sha256-aaa" },
        { path: "controls/controls-summary.json", sha256: "mock-sha256-bbb" },
        { path: "ledger/ledger-snapshot.json", sha256: "mock-sha256-ccc" },
        { path: "events/timeline.json", sha256: "mock-sha256-ddd" },
      ],
    };
  });
};

export default routes;
