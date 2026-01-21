// services/api-gateway/src/routes/org-setup.ts
import type { FastifyInstance } from "fastify";

type ConnectorCatalogItem = {
  id: string;
  name: string;
  category: "banking" | "payroll" | "accounting" | "ato" | "pos" | "other";
  description?: string;
  requiresConfig?: boolean;
};

type SetupAdmin = {
  id: string;
  email: string;
  name: string;
  createdAtUtc: string;
};

type ConnectorSelection = {
  id: string;
  enabled: boolean;
  config?: Record<string, unknown>;
};

type OrgSetupState = {
  orgId: string;
  createdAtUtc: string;

  firstAdmin?: SetupAdmin;
  connectors: ConnectorSelection[];

  completedAtUtc?: string;
};

const catalog: ConnectorCatalogItem[] = [
  {
    id: "banking:mock",
    name: "Mock Banking Connector",
    category: "banking",
    description: "Local/dev connector for simulated accounts and transactions.",
    requiresConfig: false,
  },
  {
    id: "banking:cdr",
    name: "Open Banking (CDR) Connector",
    category: "banking",
    description: "Consumer Data Right / Open Banking feed.",
    requiresConfig: true,
  },
  {
    id: "accounting:xero",
    name: "Xero",
    category: "accounting",
    description: "Accounting platform integration.",
    requiresConfig: true,
  },
  {
    id: "accounting:myob",
    name: "MYOB",
    category: "accounting",
    description: "Accounting platform integration.",
    requiresConfig: true,
  },
  {
    id: "payroll:stp",
    name: "Payroll (STP)",
    category: "payroll",
    description: "Payroll/STP-style events ingestion (placeholder).",
    requiresConfig: true,
  },
  {
    id: "ato:sbr2",
    name: "ATO SBR2",
    category: "ato",
    description: "SBR2-style messaging surface (placeholder).",
    requiresConfig: true,
  },
];

let state: OrgSetupState = {
  orgId: "org_local",
  createdAtUtc: new Date().toISOString(),
  connectors: [],
};

function status() {
  const firstAdminCreated = Boolean(state.firstAdmin);
  const connectorsConfigured = state.connectors.length > 0;
  const setupComplete = Boolean(state.completedAtUtc);

  return {
    ok: true,
    orgId: state.orgId,
    setupComplete,
    firstAdminCreated,
    connectorsConfigured,
    createdAtUtc: state.createdAtUtc,
    completedAtUtc: state.completedAtUtc ?? null,
  };
}

function denyIfComplete(app: FastifyInstance) {
  if (state.completedAtUtc) {
    void app;
    return {
      statusCode: 409,
      body: {
        error: "setup_complete",
        message: "Org setup is already complete.",
      },
    };
  }
  return null;
}

function asObject(val: unknown): Record<string, unknown> {
  if (val && typeof val === "object" && !Array.isArray(val)) return val as Record<string, unknown>;
  return {};
}

function asString(val: unknown, fallback: string): string {
  return typeof val === "string" && val.trim().length > 0 ? val.trim() : fallback;
}

function asBool(val: unknown, fallback: boolean): boolean {
  return typeof val === "boolean" ? val : fallback;
}

function randomId(prefix: string): string {
  const raw = Math.random().toString(16).slice(2);
  return `${prefix}_${raw}`;
}

export default async function orgSetupRoutes(app: FastifyInstance) {
  // Status endpoints
  app.get("/org/setup-status", async () => status());
  app.get("/org/setup/status", async () => status()); // compatibility

  // Catalog
  app.get("/org/setup/connector-catalog", async () => ({
    ok: true,
    connectors: catalog,
  }));

  // Mutations
  app.post("/org/setup/first-admin", async (request, reply) => {
    const denied = denyIfComplete(app);
    if (denied) return reply.code(denied.statusCode).send(denied.body);

    if (state.firstAdmin) {
      return reply.send({
        ok: true,
        created: false,
        admin: state.firstAdmin,
      });
    }

    const body = asObject(request.body);

    const email = asString(body.email, "admin@example.com");
    const name = asString(body.name, "Admin");

    const admin: SetupAdmin = {
      id: randomId("admin"),
      email,
      name,
      createdAtUtc: new Date().toISOString(),
    };

    state = {
      ...state,
      firstAdmin: admin,
    };

    return reply.send({
      ok: true,
      created: true,
      admin,
    });
  });

  app.post("/org/setup/connectors", async (request, reply) => {
    const denied = denyIfComplete(app);
    if (denied) return reply.code(denied.statusCode).send(denied.body);

    const body = asObject(request.body);
    const rawConnectors = Array.isArray(body.connectors) ? body.connectors : [];

    const next: ConnectorSelection[] = [];
    for (const item of rawConnectors) {
      const obj = asObject(item);
      const id = asString(obj.id, "");
      if (!id) continue;

      next.push({
        id,
        enabled: asBool(obj.enabled, true),
        config: asObject(obj.config),
      });
    }

    // If caller provided nothing, choose a safe dev default so the flow can proceed.
    const finalConnectors =
      next.length > 0
        ? next
        : [
            { id: "banking:mock", enabled: true, config: {} },
          ];

    state = {
      ...state,
      connectors: finalConnectors,
    };

    return reply.send({
      ok: true,
      applied: true,
      connectors: state.connectors,
    });
  });

  app.post("/org/setup/complete", async (_request, reply) => {
    const denied = denyIfComplete(app);
    if (denied) return reply.code(denied.statusCode).send(denied.body);

    // Require first admin + at least one connector to prevent accidental completion.
    if (!state.firstAdmin) {
      return reply.code(400).send({
        error: "missing_first_admin",
        message: "Create the first admin before completing setup.",
      });
    }
    if (state.connectors.length === 0) {
      return reply.code(400).send({
        error: "missing_connectors",
        message: "Configure connectors before completing setup.",
      });
    }

    state = {
      ...state,
      completedAtUtc: new Date().toISOString(),
    };

    return reply.send({
      ok: true,
      setupComplete: true,
      completedAtUtc: state.completedAtUtc,
    });
  });

  // Optional convenience: reset for dev (guarded by env var)
  app.post("/org/setup/reset", async (_request, reply) => {
    const enabled = String(process.env.ENABLE_ORG_SETUP_RESET ?? "").toLowerCase() === "true";
    if (!enabled) {
      return reply.code(404).send({ error: "not_found" });
    }

    state = {
      orgId: "org_local",
      createdAtUtc: new Date().toISOString(),
      connectors: [],
    };

    return reply.send({ ok: true, reset: true, status: status() });
  });
}
