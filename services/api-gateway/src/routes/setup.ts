// services/api-gateway/src/routes/setup.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { hashPassword } from "../lib/password.js";
import { readState, updateState } from "../state/dev-state.js";

type ConnectorCatalogItem = {
  id: string;
  name: string;
  description: string;
  requiredConfigKeys: string[];
};

const CONNECTOR_CATALOG: ConnectorCatalogItem[] = [
  {
    id: "ato-sbr2",
    name: "ATO SBR2",
    description: "Lodgment + messaging transport integration surface.",
    requiredConfigKeys: ["abn", "softwareId"],
  },
  {
    id: "banking-cdr",
    name: "Banking (CDR)",
    description: "Bank transaction feeds for reconciliation.",
    requiredConfigKeys: ["provider", "clientId"],
  },
  {
    id: "payroll",
    name: "Payroll",
    description: "PAYGW/PAYGI payroll inputs for obligation computation.",
    requiredConfigKeys: ["provider"],
  },
];

function badRequest(message: string, details?: Record<string, unknown>) {
  return {
    statusCode: 400,
    body: {
      error: "bad_request",
      message,
      details: details || {},
    },
  };
}

export default async function setupRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  app.get("/org/setup-status", async (_req, reply) => {
    const s = readState();
    return reply.send({
      setupComplete: s.setup.setupComplete,
      firstAdminCreated: s.setup.firstAdminCreated,
      connectorsConfigured: s.setup.connectorsConfigured,
      enabledConnectors: Object.entries(s.connectors)
        .filter(([, v]) => v.enabled)
        .map(([k]) => k),
      addons: s.orgSettings.addons,
    });
  });

  app.get("/org/setup/connector-catalog", async () => {
    return {
      connectors: CONNECTOR_CATALOG,
    };
  });

  app.post("/org/setup/first-admin", async (req, reply) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email.includes("@")) {
      const r = badRequest("Invalid email", { field: "email" });
      return reply.code(r.statusCode).send(r.body);
    }
    if (!name) {
      const r = badRequest("Name is required", { field: "name" });
      return reply.code(r.statusCode).send(r.body);
    }
    if (password.length < 10) {
      const r = badRequest("Password must be at least 10 characters", {
        field: "password",
      });
      return reply.code(r.statusCode).send(r.body);
    }

    const next = updateState((s) => {
      if (s.setup.firstAdminCreated) return;

      s.firstAdmin.email = email;
      s.firstAdmin.name = name;
      s.firstAdmin.passwordHash = hashPassword(password);
      s.setup.firstAdminCreated = true;
    });

    return reply.send({
      ok: true,
      firstAdminCreated: next.setup.firstAdminCreated,
    });
  });

  app.post("/org/setup/connectors", async (req, reply) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const connectors = body.connectors;

    if (!Array.isArray(connectors)) {
      const r = badRequest("connectors must be an array", { field: "connectors" });
      return reply.code(r.statusCode).send(r.body);
    }

    const catalogIds = new Set(CONNECTOR_CATALOG.map((c) => c.id));

    const normalized: Array<{
      id: string;
      enabled: boolean;
      config: Record<string, unknown>;
    }> = [];

    for (const item of connectors) {
      if (!item || typeof item !== "object") continue;
      const it = item as Record<string, unknown>;
      const id = typeof it.id === "string" ? it.id : "";
      if (!catalogIds.has(id)) {
        const r = badRequest("Unknown connector id", { id });
        return reply.code(r.statusCode).send(r.body);
      }
      const enabled = Boolean(it.enabled);
      const configRaw = it.config;
      const config =
        configRaw && typeof configRaw === "object" && !Array.isArray(configRaw)
          ? (configRaw as Record<string, unknown>)
          : {};
      normalized.push({ id, enabled, config });
    }

    const next = updateState((s) => {
      for (const c of normalized) {
        s.connectors[c.id] = { enabled: c.enabled, config: c.config };
      }
      s.setup.connectorsConfigured = true;
    });

    return reply.send({
      ok: true,
      connectorsConfigured: next.setup.connectorsConfigured,
      enabledConnectors: Object.entries(next.connectors)
        .filter(([, v]) => v.enabled)
        .map(([k]) => k),
    });
  });

  app.post("/org/setup/complete", async (_req, reply) => {
    const next = updateState((s) => {
      if (!s.setup.firstAdminCreated) return;
      if (!s.setup.connectorsConfigured) return;
      s.setup.setupComplete = true;
    });

    if (!next.setup.setupComplete) {
      const r = badRequest("Cannot complete setup yet", {
        requires: {
          firstAdminCreated: next.setup.firstAdminCreated,
          connectorsConfigured: next.setup.connectorsConfigured,
        },
      });
      return reply.code(r.statusCode).send(r.body);
    }

    return reply.send({ ok: true, setupComplete: true });
  });
}
