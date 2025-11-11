import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../db.js";
import { assertOrgAccess } from "../utils/orgScope.js";
import { publishComplianceEvent } from "../lib/event-publisher.js";

const createDiscrepancySchema = z.object({
  orgId: z.string().min(1),
  reference: z.string().min(1),
  type: z.string().min(1),
  category: z.string().min(1),
  severity: z.string().min(1).default("MEDIUM"),
  status: z.string().min(1).default("OPEN"),
  description: z.string().max(10_000).optional(),
  source: z.string().optional(),
  context: z.record(z.any()).optional(),
  detectedAt: z.preprocess(
    (v) => (typeof v === "string" || v instanceof Date ? new Date(v as any) : undefined),
    z.date().optional(),
  ),
  resolutionNote: z.string().optional(),
});

const createFraudCaseSchema = z.object({
  orgId: z.string().min(1),
  discrepancyId: z.string().min(1),
  hypothesis: z.string().min(1),
  status: z.string().min(1).default("UNDER_REVIEW"),
  riskBand: z.string().optional(),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .optional(),
  context: z.record(z.any()).optional(),
});

const createRemediationSchema = z
  .object({
    orgId: z.string().min(1),
    discrepancyId: z.string().optional(),
    fraudCaseId: z.string().optional(),
    type: z.string().min(1),
    status: z.string().min(1).default("PLANNED"),
    owner: z.string().optional(),
    dueDate: z.preprocess(
      (v) => (typeof v === "string" || v instanceof Date ? new Date(v as any) : undefined),
      z.date().optional(),
    ),
    evidenceArtifactId: z.string().optional(),
    notes: z.record(z.any()).optional(),
    outcome: z.string().optional(),
  })
  .refine((value) => value.discrepancyId || value.fraudCaseId, {
    message: "discrepancyId or fraudCaseId must be provided",
    path: ["discrepancyId"],
  });

const createPaymentPlanSchema = z.object({
  orgId: z.string().min(1),
  discrepancyId: z.string().optional(),
  fraudCaseId: z.string().optional(),
  basCycleId: z.string().optional(),
  requestId: z.string().optional(),
  status: z.string().min(1).default("PENDING_APPROVAL"),
  totalDue: z.number().positive(),
  downPayment: z.number().min(0).optional(),
  schedule: z
    .array(
      z.object({
        dueDate: z.preprocess(
          (v) => (typeof v === "string" || v instanceof Date ? new Date(v as any) : undefined),
          z.date(),
        ),
        amount: z.number().min(0),
        label: z.string().optional(),
      }),
    )
    .min(1),
  auditTrail: z.record(z.any()).optional(),
});

export const registerComplianceRoutes: FastifyPluginAsync = async (app) => {
  app.post("/compliance/discrepancies", async (req, reply) => {
    const user = (req as any).user;
    if (!user) {
      reply.code(401).send({ error: "unauthenticated" });
      return;
    }

    const parsed = createDiscrepancySchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }

    if (!assertOrgAccess(req, reply, parsed.data.orgId)) {
      return;
    }

    const data = parsed.data;

    const discrepancy = await prisma.complianceDiscrepancy.upsert({
      where: {
        orgId_reference: {
          orgId: data.orgId,
          reference: data.reference,
        },
      },
      update: {
        status: data.status,
        severity: data.severity,
        description: data.description,
        source: data.source,
        context: data.context,
        resolutionNote: data.resolutionNote,
      },
      create: {
        orgId: data.orgId,
        reference: data.reference,
        type: data.type,
        category: data.category,
        status: data.status,
        severity: data.severity,
        description: data.description,
        source: data.source,
        context: data.context,
        detectedAt: data.detectedAt ?? new Date(),
        resolutionNote: data.resolutionNote,
      },
    });

    await publishComplianceEvent(app, {
      orgId: discrepancy.orgId,
      eventType: "discrepancy.recorded",
      key: `${discrepancy.orgId}:${discrepancy.id}`,
      dedupeId: discrepancy.id,
      request: req,
      payload: {
        discrepancyId: discrepancy.id,
        reference: discrepancy.reference,
        category: discrepancy.category,
        status: discrepancy.status,
        severity: discrepancy.severity,
        detectedAt: discrepancy.detectedAt,
        context: discrepancy.context,
      },
    });

    reply.code(201).send({ discrepancy });
  });

  app.post("/compliance/fraud-cases", async (req, reply) => {
    const user = (req as any).user;
    if (!user) {
      reply.code(401).send({ error: "unauthenticated" });
      return;
    }

    const parsed = createFraudCaseSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }

    if (!assertOrgAccess(req, reply, parsed.data.orgId)) {
      return;
    }

    const data = parsed.data;

    const fraudCase = await prisma.complianceFraudCase.create({
      data: {
        orgId: data.orgId,
        discrepancyId: data.discrepancyId,
        hypothesis: data.hypothesis,
        status: data.status,
        riskBand: data.riskBand,
        confidence: data.confidence !== undefined ? new Prisma.Decimal(data.confidence) : undefined,
        context: data.context,
      },
    });

    await publishComplianceEvent(app, {
      orgId: fraudCase.orgId,
      eventType: "fraud_case.opened",
      key: `${fraudCase.orgId}:${fraudCase.id}`,
      dedupeId: fraudCase.id,
      request: req,
      payload: {
        fraudCaseId: fraudCase.id,
        discrepancyId: fraudCase.discrepancyId,
        status: fraudCase.status,
        riskBand: fraudCase.riskBand,
        confidence: data.confidence,
      },
    });

    reply.code(201).send({ fraudCase });
  });

  app.post("/compliance/remediations", async (req, reply) => {
    const user = (req as any).user;
    if (!user) {
      reply.code(401).send({ error: "unauthenticated" });
      return;
    }

    const parsed = createRemediationSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }

    if (!assertOrgAccess(req, reply, parsed.data.orgId)) {
      return;
    }

    const data = parsed.data;

    const remediation = await prisma.complianceRemediationAction.create({
      data: {
        orgId: data.orgId,
        discrepancyId: data.discrepancyId,
        fraudCaseId: data.fraudCaseId,
        type: data.type,
        status: data.status,
        owner: data.owner,
        dueDate: data.dueDate,
        evidenceArtifactId: data.evidenceArtifactId,
        notes: data.notes,
        outcome: data.outcome,
      },
    });

    await publishComplianceEvent(app, {
      orgId: remediation.orgId,
      eventType: "remediation.logged",
      key: `${remediation.orgId}:${remediation.id}`,
      dedupeId: remediation.id,
      request: req,
      payload: {
        remediationId: remediation.id,
        discrepancyId: remediation.discrepancyId,
        fraudCaseId: remediation.fraudCaseId,
        status: remediation.status,
        dueDate: remediation.dueDate,
      },
    });

    reply.code(201).send({ remediation });
  });

  app.post("/compliance/payment-plans", async (req, reply) => {
    const user = (req as any).user;
    if (!user) {
      reply.code(401).send({ error: "unauthenticated" });
      return;
    }

    const parsed = createPaymentPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }

    if (!assertOrgAccess(req, reply, parsed.data.orgId)) {
      return;
    }

    const data = parsed.data;

    const paymentPlan = await prisma.compliancePaymentPlan.create({
      data: {
        orgId: data.orgId,
        discrepancyId: data.discrepancyId,
        fraudCaseId: data.fraudCaseId,
        basCycleId: data.basCycleId,
        requestId: data.requestId,
        status: data.status,
        totalDue: new Prisma.Decimal(data.totalDue),
        downPayment: data.downPayment !== undefined ? new Prisma.Decimal(data.downPayment) : undefined,
        schedule: data.schedule.map((entry) => ({
          dueDate: entry.dueDate instanceof Date ? entry.dueDate.toISOString() : new Date(entry.dueDate).toISOString(),
          amount: entry.amount,
          label: entry.label,
        })),
        auditTrail: data.auditTrail,
      },
    });

    await publishComplianceEvent(app, {
      orgId: paymentPlan.orgId,
      eventType: "payment_plan.created",
      key: `${paymentPlan.orgId}:${paymentPlan.id}`,
      dedupeId: paymentPlan.id,
      request: req,
      payload: {
        paymentPlanId: paymentPlan.id,
        discrepancyId: paymentPlan.discrepancyId,
        fraudCaseId: paymentPlan.fraudCaseId,
        status: paymentPlan.status,
        totalDue: data.totalDue,
        schedule: data.schedule,
      },
    });

    reply.code(201).send({ paymentPlan });
  });
};

export default registerComplianceRoutes;
