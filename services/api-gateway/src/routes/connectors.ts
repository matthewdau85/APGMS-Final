import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { parseWithSchema } from "../lib/validation.js";
import { assertRoleForBankLines, requireOrgContext } from "../utils/orgScope.js";
import { prisma } from "../db.js";
import { recordAuditLog, recordCriticalAuditLog } from "../lib/audit.js";
import { withIdempotency } from "../lib/idempotency.js";
import { capturePayroll, capturePos } from "@apgms/connectors";
import type { AuditLogger } from "@apgms/domain-policy";
import type { JsonValue } from "@prisma/client/runtime/library.js";

const CaptureBodySchema = z.object({
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

async function processCapture(
  request: FastifyRequest,
  reply: FastifyReply,
  type: "payroll" | "pos",
  payload: CapturePayload,
  deps: ConnectorRoutesDeps,
) {
  const ctx = requireOrgContext(request, reply);
  if (!ctx) return;
  if (!assertRoleForBankLines(request, reply)) return;

  await withIdempotency(
    request,
    reply,
    {
      prisma,
      orgId: ctx.orgId,
      actorId: ctx.actorId,
      requestPayload: payload,
    },
    async () => {
      const captureFn = type === "payroll" ? deps.capturePayroll : deps.capturePos;
      const result = await captureFn(
        {
          prisma,
          auditLogger: async (entry) => {
            const metadata =
              entry.metadata == null
                ? null
                : (JSON.parse(JSON.stringify(entry.metadata)) as JsonValue);
            return recordAuditLog({
              ...entry,
              metadata,
              throwOnError: true,
            });
          },
        },
        {
          orgId: ctx.orgId,
          amount: payload.amount,
          actorId: ctx.actorId,
        },
      );

      await recordCriticalAuditLog({
        orgId: ctx.orgId,
        actorId: ctx.actorId,
        action: `demo.connectors.${type}`,
        metadata: { amount: payload.amount },
      });

      reply.send(result);

      return { statusCode: 200 };
    },
  );
}

export function registerConnectorRoutes(app: FastifyInstance, deps: ConnectorRoutesDeps = defaultConnectorDeps) {
  const handler = (type: "payroll" | "pos") => async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = parseWithSchema(CaptureBodySchema, request.body);
    await processCapture(request, reply, type, payload, deps);
  };

  app.post("/connectors/capture/payroll", handler("payroll"));
  app.post("/connectors/capture/pos", handler("pos"));
}
