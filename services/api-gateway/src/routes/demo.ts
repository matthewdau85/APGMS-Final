import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prototypeAdminGuard } from "../guards/prototype-admin.js";

const bankSchema = z.object({
  daysBack: z.number().int().min(1).max(30).default(7),
  intensity: z.enum(["low", "high"]).default("low"),
});

export async function registerDemoRoutes(app: FastifyInstance) {
  const enabled = String(process.env.ENABLE_PROTOTYPE ?? "").toLowerCase() === "true";
  if (!enabled) return;

  // Header-based prototype admin access for demo routes
  app.addHook("preHandler", prototypeAdminGuard());

  // POST /prototype/demo/banking/generate
  app.post("/banking/generate", async (req) => {
    const parsed = bankSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return { ok: false, error: "invalid_body", details: parsed.error.flatten() };
    }

    const { daysBack, intensity } = parsed.data;

    // TODO: replace with real prisma generator later
    return {
      ok: true,
      generatedDays: daysBack,
      intensity,
      note: "Prototype demo bank feed generated (mock).",
      rows: Array.from({ length: daysBack }).map((_, i) => ({
        id: `demo_bank_${i + 1}`,
        at: new Date(Date.now() - (daysBack - i) * 86400000).toISOString(),
        amount: i % 2 === 0 ? 1200 : -600,
        desc: i % 2 === 0 ? "Demo POS Sale" : "Demo Payroll Settlement",
      })),
    };
  });

  // GET /prototype/demo/state?orgId=...
  app.get("/state", async (req) => {
    const orgId = (req.query as any)?.orgId?.toString() ?? null;
    return {
      ok: true,
      state: {
        org: orgId,
        settings: {},
        obligations: [],
      },
    };
  });

  // (Optional now) GET /prototype/demo/events?orgId=...&afterTs=...
  app.get("/events", async (req) => {
    const orgId = (req.query as any)?.orgId?.toString() ?? null;
    const afterTs = Number((req.query as any)?.afterTs ?? 0);

    return {
      ok: true,
      orgId,
      afterTs,
      events: [
        { ts: Date.now(), type: "demo.event", detail: "Mock event stream placeholder" },
      ],
    };
  });
}
