import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticateRequest, type Role } from "../lib/auth.js";
import { parseWithSchema } from "../lib/validation.js";

const fraudAlertSchema = z.object({
  orgId: z.string().uuid(),
  fraudAlertId: z.string().uuid().optional(),
  discrepancyId: z.string().uuid().optional(),
  alertCode: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  summary: z.string().min(1),
  metadata: z.record(z.string(), z.any()).optional(),
});

const remediationSchema = z.object({
  orgId: z.string().uuid(),
  remediationId: z.string().uuid().optional(),
  discrepancyId: z.string().uuid().optional(),
  fraudAlertId: z.string().uuid().optional(),
  actionType: z.string().min(1),
  status: z.string().min(1).optional(),
  assignedTo: z.string().min(1).optional(),
  dueAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export async function registerComplianceRoutes(app: FastifyInstance): Promise<void> {
  const guard = (roles: readonly Role[] = []) =>
    async (req: FastifyRequest, reply: FastifyReply) =>
      authenticateRequest(app, req, reply, roles);

  app.post(
    "/compliance/fraud-alerts",
    { preHandler: guard(["analyst", "admin"]) },
    async (request, reply) => {
      const body = parseWithSchema(fraudAlertSchema, request.body);
      const principalOrgId = request.principal?.orgId ?? request.user?.orgId;
      if (!principalOrgId) {
        request.log.error({ route: "/compliance/fraud-alerts" }, "missing_principal_org");
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
      const fraudAlertId = body.fraudAlertId ?? randomUUID();

      if (!request.publishDomainEvent) {
        app.log.warn({ route: "/compliance/fraud-alerts" }, "domain_event_publisher_missing");
      } else {
        await request.publishDomainEvent({
          subject: "compliance.fraud",
          eventType: "compliance.fraud-alert.raised",
          orgId: principalOrgId,
          key: fraudAlertId,
          payload: {
            fraudAlertId,
            discrepancyId: body.discrepancyId ?? null,
            alertCode: body.alertCode,
            severity: body.severity,
            summary: body.summary,
            metadata: body.metadata ?? null,
          },
          source: "services.api-gateway.compliance",
        });
      }

      reply.code(202).send({ fraudAlertId, accepted: true });
    },
  );

  app.post(
    "/compliance/remediations",
    { preHandler: guard(["analyst", "admin"]) },
    async (request, reply) => {
      const body = parseWithSchema(remediationSchema, request.body);
      const principalOrgId = request.principal?.orgId ?? request.user?.orgId;
      if (!principalOrgId) {
        request.log.error({ route: "/compliance/remediations" }, "missing_principal_org");
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
      const remediationId = body.remediationId ?? randomUUID();
      const status = body.status ?? "pending";

      if (!request.publishDomainEvent) {
        app.log.warn({ route: "/compliance/remediations" }, "domain_event_publisher_missing");
      } else {
        await request.publishDomainEvent({
          subject: "compliance.remediation",
          eventType: "compliance.remediation.action-tracked",
          orgId: principalOrgId,
          key: remediationId,
          payload: {
            remediationId,
            discrepancyId: body.discrepancyId ?? null,
            fraudAlertId: body.fraudAlertId ?? null,
            actionType: body.actionType,
            status,
            assignedTo: body.assignedTo ?? null,
            dueAt: body.dueAt ?? null,
            notes: body.notes ?? null,
            metadata: body.metadata ?? null,
          },
          source: "services.api-gateway.compliance",
        });
      }

      reply.code(202).send({ remediationId, status, accepted: true });
    },
  );
}

