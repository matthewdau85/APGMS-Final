import { randomUUID } from "node:crypto";

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { publishOperationalEvent, operationalSubjects } from "../lib/events.js";
import { assertOrgAccess } from "../utils/orgScope.js";

const remediationSchema = z.object({
  orgId: z.string().min(1),
  remediationId: z.string().uuid().optional(),
  discrepancyEventId: z.string().uuid().optional(),
  fraudAlertId: z.string().uuid().optional(),
  actionType: z.string().min(1),
  owner: z.string().min(1).optional(),
  dueAt: z.preprocess(
    (v) => (typeof v === "string" || v instanceof Date ? new Date(v as any) : v),
    z.date().optional()
  ),
  notes: z.string().max(2000).optional(),
  metadata: z.record(z.any()).optional(),
});

const paymentPlanSchema = z.object({
  orgId: z.string().min(1),
  agreementId: z.string().uuid().optional(),
  paymentPlanRequestId: z.string().uuid().optional(),
  discrepancyEventId: z.string().uuid().optional(),
  basCycleId: z.string().uuid().optional(),
  authority: z.string().min(1),
  reference: z.string().min(1),
  status: z.string().min(1).optional(),
  startDate: z.preprocess(
    (v) => (typeof v === "string" || v instanceof Date ? new Date(v as any) : v),
    z.date()
  ),
  endDate: z.preprocess(
    (v) => (typeof v === "string" || v instanceof Date ? new Date(v as any) : v),
    z.date().optional()
  ),
  terms: z.record(z.any()),
});

export const registerComplianceRoutes: FastifyPluginAsync = async (app) => {
  app.post("/compliance/remediation-actions", async (req, reply) => {
    const user = (req as any).user!;
    assertOrgAccess(req, reply, user.orgId);

    const parsed = remediationSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }

    const data = parsed.data;
    if (data.orgId !== user.orgId) {
      reply.code(403).send({ error: "forbidden" });
      return;
    }

    const remediationId = data.remediationId ?? randomUUID();

    await publishOperationalEvent(app, {
      subject: operationalSubjects.compliance.remediationLogged,
      eventType: "compliance.remediation.logged",
      orgId: data.orgId,
      key: remediationId,
      payload: {
        remediationId,
        discrepancyEventId: data.discrepancyEventId ?? null,
        fraudAlertId: data.fraudAlertId ?? null,
        actionType: data.actionType,
        owner: data.owner ?? user.sub,
        dueAt: data.dueAt?.toISOString() ?? null,
        notes: data.notes ?? null,
        metadata: data.metadata ?? {},
        status: "PENDING",
        recordedBy: user.sub,
      },
    }, req as any);

    reply.code(202).send({ status: "accepted", remediationId });
  });

  app.post("/compliance/payment-plans", async (req, reply) => {
    const user = (req as any).user!;
    assertOrgAccess(req, reply, user.orgId);

    const parsed = paymentPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }

    const data = parsed.data;
    if (data.orgId !== user.orgId) {
      reply.code(403).send({ error: "forbidden" });
      return;
    }

    const agreementId = data.agreementId ?? randomUUID();

    await publishOperationalEvent(app, {
      subject: operationalSubjects.compliance.paymentPlanAgreed,
      eventType: "compliance.payment_plan.agreed",
      orgId: data.orgId,
      key: agreementId,
      payload: {
        agreementId,
        paymentPlanRequestId: data.paymentPlanRequestId ?? null,
        discrepancyEventId: data.discrepancyEventId ?? null,
        basCycleId: data.basCycleId ?? null,
        authority: data.authority,
        reference: data.reference,
        status: data.status ?? "ACTIVE",
        startDate: data.startDate.toISOString(),
        endDate: data.endDate?.toISOString() ?? null,
        terms: data.terms,
        recordedBy: user.sub,
      },
    }, req as any);

    reply.code(201).send({ status: "created", agreementId });
  });
};

export default registerComplianceRoutes;
