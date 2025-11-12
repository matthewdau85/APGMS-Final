import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { parseWithSchema } from "../lib/validation.js";
import { assertOrgAccess, assertRoleForBankLines } from "../utils/orgScope.js";
import { prisma } from "../db.js";
import { recordAuditLog } from "../lib/audit.js";
import { capturePayroll, capturePos } from "@apgms/connectors";
import type { AuditLogger } from "@apgms/domain-policy";
import type { JsonValue } from "@prisma/client/runtime/library.js";

const CaptureBodySchema = z.object({
  orgId: z.string().min(1),
  amount: z.number().positive(),
});

type CapturePayload = z.infer<typeof CaptureBodySchema>;

export type ConnectorRoutesDeps = {
  capturePayroll: typeof capturePayroll;
  capturePos: typeof capturePos;
};

const defaultConnectorDeps: ConnectorRoutesDeps = {
  capturePayroll,
  capturePos,
};

function captureContext(request: FastifyRequest) {
  return {
    prisma,
    auditLogger: async (entry: Parameters<AuditLogger>[0]) => {
      const metadata =
        entry.metadata == null
          ? null
          : (JSON.parse(JSON.stringify(entry.metadata)) as JsonValue);
      return recordAuditLog({
        orgId: entry.orgId,
        actorId: entry.actorId,
        action: entry.action,
        metadata,
        throwOnError: true,
      });
    },
  };
}

async function processCapture(
  request: FastifyRequest,
  reply: FastifyReply,
  type: "payroll" | "pos",
  payload: CapturePayload,
  deps: ConnectorRoutesDeps,
) {
  const user = (request as FastifyRequest & { user?: { orgId?: string; sub?: string } }).user;
  if (!user) {
    reply.code(401).send({ error: "unauthorized" });
    return;
  }

  if (!assertOrgAccess(request, reply, payload.orgId)) return;
  if (!assertRoleForBankLines(request, reply)) return;

  const actorId = user.sub;
  const context = captureContext(request as FastifyRequest);

  const captureFn = type === "payroll" ? deps.capturePayroll : deps.capturePos;
  const result = await captureFn(context, { ...payload, actorId });

  reply.send(result);
}

export function registerConnectorRoutes(app: FastifyInstance, deps: ConnectorRoutesDeps = defaultConnectorDeps) {
  const handler = (type: "payroll" | "pos") => async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = parseWithSchema(CaptureBodySchema, request.body);
    await processCapture(request, reply, type, payload, deps);
  };

  app.post("/connectors/capture/payroll", handler("payroll"));
  app.post("/connectors/capture/pos", handler("pos"));
}
