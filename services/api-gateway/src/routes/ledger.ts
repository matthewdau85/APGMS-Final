import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticateRequest, type Role } from "../lib/auth.js";
import { parseWithSchema } from "../lib/validation.js";

const ledgerDiscrepancySchema = z.object({
  orgId: z.string().uuid(),
  discrepancyId: z.string().uuid().optional(),
  source: z.string().min(1),
  category: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  summary: z.string().min(1),
  status: z.string().min(1).optional(),
  detectedAt: z.string().datetime().optional(),
  amountCents: z.coerce.number().int().optional(),
  details: z.record(z.string(), z.any()).optional(),
});

export async function registerLedgerRoutes(app: FastifyInstance): Promise<void> {
  const guard = (roles: readonly Role[] = []) =>
    async (req: FastifyRequest, reply: FastifyReply) =>
      authenticateRequest(app, req, reply, roles);

  app.post(
    "/ledger/discrepancies",
    { preHandler: guard(["analyst", "admin"]) },
    async (request, reply) => {
      const body = parseWithSchema(ledgerDiscrepancySchema, request.body);
      const principalOrgId = request.principal?.orgId ?? request.user?.orgId;
      if (!principalOrgId) {
        request.log.error({ route: "/ledger/discrepancies" }, "missing_principal_org");
        reply.code(500).send({
          error: { code: "principal_missing", message: "Unable to resolve organisation" },
        });
        return;
      }
      if (body.orgId !== principalOrgId) {
        reply.code(403).send({
          error: { code: "forbidden_org_scope", message: "Organisation mismatch" },
        });
        return;
      }
      const discrepancyId = body.discrepancyId ?? randomUUID();
      const detectedAt = body.detectedAt ?? new Date().toISOString();
      const status = body.status ?? "open";

      if (!request.publishDomainEvent) {
        app.log.warn({ route: "/ledger/discrepancies" }, "domain_event_publisher_missing");
      } else {
        await request.publishDomainEvent({
          subject: "ledger.discrepancy",
          eventType: "ledger.discrepancy.recorded",
          orgId: principalOrgId,
          key: discrepancyId,
          payload: {
            discrepancyId,
            source: body.source,
            category: body.category,
            severity: body.severity,
            summary: body.summary,
            status,
            detectedAt,
            amountCents: body.amountCents ?? null,
            details: body.details ?? null,
          },
          source: "services.api-gateway.ledger",
        });
      }

      reply.code(202).send({ discrepancyId, status, accepted: true });
    },
  );
}

