// services/api-gateway/src/routes/setup.ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  loadSetupState,
  saveSetupState,
  newId,
  type ConnectorMode,
  type SetupState,
} from "../lib/setup-state.js";
import { hashPassword } from "../lib/password.js";

type AnyReq = FastifyRequest;

function sendError(reply: FastifyReply, status: number, error: string, message: string) {
  return reply.code(status).send({ error, message });
}

function requireSetupKey(req: AnyReq, reply: FastifyReply): boolean {
  const key = (process.env.SETUP_KEY ?? "").trim();
  if (!key) return true; // no key required
  const got = String(req.headers["x-apgms-setup-key"] ?? "");
  if (got !== key) {
    sendError(reply, 401, "unauthorized", "Missing or invalid setup key.");
    return false;
  }
  return true;
}

const FirstAdminBody = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200).default("Admin"),
  password: z.string().min(8).max(200),
});

const ConnectorItem = z.object({
  sector: z.string().min(1).max(64),
  vendor: z.string().min(1).max(64),
  mode: z.enum(["mock", "production"]).default("mock"),
  displayName: z.string().min(1).max(128),
  config: z.record(z.unknown()).default({}),
});

const ConnectorsBody = z.object({
  connectors: z.array(ConnectorItem).min(1).max(200),
});

type CatalogItem = {
  sector: string;
  vendor: string;
  displayName: string;
  defaultMode: ConnectorMode;
  notes: string;
};

// Keep the catalog small-but-useful. You can expand this as your connector framework matures.
const CONNECTOR_CATALOG: CatalogItem[] = [
  // Banking (AU majors + a couple common challengers)
  { sector: "banking", vendor: "CBA", displayName: "Commonwealth Bank", defaultMode: "mock", notes: "AU major bank" },
  { sector: "banking", vendor: "NAB", displayName: "National Australia Bank", defaultMode: "mock", notes: "AU major bank" },
  { sector: "banking", vendor: "Westpac", displayName: "Westpac", defaultMode: "mock", notes: "AU major bank" },
  { sector: "banking", vendor: "ANZ", displayName: "ANZ", defaultMode: "mock", notes: "AU major bank" },
  { sector: "banking", vendor: "ING", displayName: "ING Australia", defaultMode: "mock", notes: "Common retail bank in AU" },
  { sector: "banking", vendor: "Up", displayName: "Up Bank", defaultMode: "mock", notes: "Digital bank (Bendigo-backed)" },

  // Accounting / GL
  { sector: "accounting", vendor: "Xero", displayName: "Xero", defaultMode: "mock", notes: "Market-leading SMB accounting (AU/NZ)" },
  { sector: "accounting", vendor: "MYOB", displayName: "MYOB", defaultMode: "mock", notes: "Strong AU SMB accounting footprint" },
  { sector: "accounting", vendor: "QuickBooks", displayName: "QuickBooks Online", defaultMode: "mock", notes: "Common globally; present in AU" },

  // Payroll / HRIS
  { sector: "payroll", vendor: "KeyPay", displayName: "KeyPay", defaultMode: "mock", notes: "Popular AU payroll platform" },
  { sector: "payroll", vendor: "EmploymentHero", displayName: "Employment Hero", defaultMode: "mock", notes: "HR + payroll ecosystem" },
  { sector: "payroll", vendor: "XeroPayroll", displayName: "Xero Payroll", defaultMode: "mock", notes: "Payroll within Xero ecosystem" },

  // POS / Commerce
  { sector: "pos", vendor: "Square", displayName: "Square POS", defaultMode: "mock", notes: "Common AU SMB POS + payments" },
  { sector: "pos", vendor: "Shopify", displayName: "Shopify", defaultMode: "mock", notes: "Ecommerce + POS; common AU merchants" },
  { sector: "pos", vendor: "Lightspeed", displayName: "Lightspeed", defaultMode: "mock", notes: "Retail/hospitality POS footprint" },

  // Payments
  { sector: "payments", vendor: "Stripe", displayName: "Stripe", defaultMode: "mock", notes: "Online payments + billing" },
  { sector: "payments", vendor: "Tyro", displayName: "Tyro", defaultMode: "mock", notes: "AU payments/acquiring (SMB)" },
  { sector: "payments", vendor: "PayPal", displayName: "PayPal", defaultMode: "mock", notes: "Common consumer/business payments" },

  // Government / Tax
  { sector: "tax", vendor: "ATO_SBR", displayName: "ATO SBR (future)", defaultMode: "mock", notes: "Placeholder for SBR-style integration surface" },
];

async function statusShape(state: SetupState) {
  return {
    setupComplete: state.setupComplete,
    firstAdminCreated: Boolean(state.firstAdmin),
    connectorsConfigured: state.connectors.length > 0,
    steps: {
      firstAdmin: Boolean(state.firstAdmin),
      connectors: state.connectors.length > 0,
      complete: state.setupComplete,
    },
  };
}

export default async function setupRoutes(app: FastifyInstance) {
  // Status: wizard uses this to decide whether to show itself and which step to render.
  app.get("/org/setup-status", async (_req, reply) => {
    const state = await loadSetupState();
    return reply.send(await statusShape(state));
  });

  // Catalog: wizard uses this to populate the selectable connector options.
  app.get("/org/setup/connector-catalog", async (_req, reply) => {
    return reply.send({ connectors: CONNECTOR_CATALOG });
  });

  // Create first admin: hashes password and stores it in setup state.
  app.post("/org/setup/first-admin", async (req, reply) => {
    if (!requireSetupKey(req, reply)) return;

    const parsed = FirstAdminBody.safeParse((req as AnyReq).body ?? {});
    if (!parsed.success) {
      return sendError(reply, 400, "validation_error", "Invalid first admin payload.");
    }

    const { email, name, password } = parsed.data;
    const state = await loadSetupState();

    if (state.setupComplete) {
      return sendError(reply, 409, "already_complete", "Setup is already complete.");
    }

    if (state.firstAdmin) {
      return sendError(reply, 409, "already_exists", "First admin is already created.");
    }

    const passwordHash = hashPassword(password);
    state.firstAdmin = {
      id: newId(),
      email,
      name,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    await saveSetupState(state);

    return reply.send({
      ok: true,
      firstAdminCreated: true,
      admin: { id: state.firstAdmin.id, email: state.firstAdmin.email, name: state.firstAdmin.name },
    });
  });

  // Configure connectors: wizard submits selected connector list.
  app.post("/org/setup/connectors", async (req, reply) => {
    if (!requireSetupKey(req, reply)) return;

    const parsed = ConnectorsBody.safeParse((req as AnyReq).body ?? {});
    if (!parsed.success) {
      return sendError(reply, 400, "validation_error", "Invalid connectors payload.");
    }

    const state = await loadSetupState();

    if (state.setupComplete) {
      return sendError(reply, 409, "already_complete", "Setup is already complete.");
    }

    // Upsert by sector+vendor (stable identity for wizard resubmits)
    const byKey = new Map<string, (typeof parsed.data.connectors)[number]>();
    for (const c of parsed.data.connectors) {
      byKey.set(`${c.sector}::${c.vendor}`, c);
    }

    const existingByKey = new Map<string, string>(); // key -> id
    for (const c of state.connectors) {
      existingByKey.set(`${c.sector}::${c.vendor}`, c.id);
    }

    const next = [];
    for (const [key, c] of byKey.entries()) {
      const id = existingByKey.get(key) ?? newId();
      next.push({
        id,
        sector: c.sector,
        vendor: c.vendor,
        mode: c.mode,
        displayName: c.displayName,
        config: c.config ?? {},
        createdAt: new Date().toISOString(),
      });
    }

    state.connectors = next;
    await saveSetupState(state);

    return reply.send({
      ok: true,
      connectorsConfigured: true,
      count: state.connectors.length,
      connectors: state.connectors.map((c) => ({
        id: c.id,
        sector: c.sector,
        vendor: c.vendor,
        mode: c.mode,
        displayName: c.displayName,
      })),
    });
  });

  // Complete: wizard calls this when done.
  app.post("/org/setup/complete", async (req, reply) => {
    if (!requireSetupKey(req, reply)) return;

    const state = await loadSetupState();

    if (state.setupComplete) {
      return reply.send({ ok: true, setupComplete: true });
    }

    if (!state.firstAdmin) {
      return sendError(reply, 409, "missing_first_admin", "Create the first admin before completing setup.");
    }

    if (state.connectors.length === 0) {
      return sendError(reply, 409, "missing_connectors", "Configure at least one connector before completing setup.");
    }

    state.setupComplete = true;
    await saveSetupState(state);

    return reply.send({ ok: true, setupComplete: true });
  });
}
