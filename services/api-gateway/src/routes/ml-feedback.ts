import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { authenticateRequest, type Role } from "../lib/auth.js";

const LABEL_INPUT = {
  false_positive: "FALSE_POSITIVE",
  false_negative: "FALSE_NEGATIVE",
} as const;

type LabelInput = keyof typeof LABEL_INPUT;
type PrismaLabel = (typeof LABEL_INPUT)[LabelInput];

const captureSchema = z.object({
  orgId: z.string().min(1),
  inferenceId: z.string().min(1),
  modelName: z.string().min(1),
  modelVersion: z.string().min(1).optional(),
  predictedLabel: z.string().min(1).optional(),
  expectedLabel: z.string().min(1).optional(),
  label: z.enum(["false_positive", "false_negative"]),
  notes: z.string().max(2000).optional(),
  payload: z.record(z.any()).optional(),
});

const listQuerySchema = z.object({
  modelName: z.string().optional(),
  inferenceId: z.string().optional(),
  label: z.enum(["false_positive", "false_negative"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
});

function parseLabel(value: LabelInput): PrismaLabel {
  return LABEL_INPUT[value];
}

function serializeLabel(label: PrismaLabel | string): LabelInput {
  return label === LABEL_INPUT.false_positive ? "false_positive" : "false_negative";
}

function serialise(record: {
  id: string;
  orgId: string;
  inferenceId: string;
  modelName: string;
  modelVersion: string | null;
  predictedLabel: string | null;
  expectedLabel: string | null;
  label: PrismaLabel | string;
  submittedById: string | null;
  notes: string | null;
  payload: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: record.id,
    orgId: record.orgId,
    inferenceId: record.inferenceId,
    modelName: record.modelName,
    modelVersion: record.modelVersion,
    predictedLabel: record.predictedLabel,
    expectedLabel: record.expectedLabel,
    label: serializeLabel(record.label),
    submittedById: record.submittedById,
    notes: record.notes,
    payload: record.payload,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

const FEEDBACK_ROLES: readonly Role[] = ["admin", "analyst"];

type Dependencies = {
  prisma?: typeof prisma;
  authenticate?: typeof authenticateRequest;
};

export async function registerMlFeedbackRoutes(app: FastifyInstance, deps: Dependencies = {}) {
  const client = deps.prisma ?? prisma;
  const authenticate = deps.authenticate ?? ((req: FastifyRequest, reply: FastifyReply, roles: readonly Role[]) => authenticateRequest(app, req, reply, roles));

  app.post("/ml/feedback", async (req: FastifyRequest, reply: FastifyReply) => {
    const principal = await authenticate(req, reply, FEEDBACK_ROLES);
    if (!principal) {
      return;
    }

    const body = req.body;
    const parsed = captureSchema.safeParse(body ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }

    const data = parsed.data;
    const label = parseLabel(data.label as LabelInput);
    const rawBody =
      typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const hasBodyProp = (key: string) => Object.prototype.hasOwnProperty.call(rawBody, key);

    if (data.orgId !== principal.orgId) {
      reply.code(403).send({ error: "forbidden" });
      return;
    }

    try {
      const record = await client.modelFeedback.upsert({
        where: { orgId_inferenceId: { orgId: data.orgId, inferenceId: data.inferenceId } },
        update: {
          modelName: data.modelName,
          label,
          submittedById: principal.id,
          ...(hasBodyProp("modelVersion") ? { modelVersion: data.modelVersion ?? null } : {}),
          ...(hasBodyProp("predictedLabel")
            ? { predictedLabel: data.predictedLabel ?? null }
            : {}),
          ...(hasBodyProp("expectedLabel")
            ? { expectedLabel: data.expectedLabel ?? null }
            : {}),
          ...(hasBodyProp("notes") ? { notes: data.notes ?? null } : {}),
          ...(hasBodyProp("payload") ? { payload: data.payload ?? undefined } : {}),
        },
        create: {
          orgId: data.orgId,
          inferenceId: data.inferenceId,
          modelName: data.modelName,
          modelVersion: data.modelVersion ?? null,
          predictedLabel: data.predictedLabel ?? null,
          expectedLabel: data.expectedLabel ?? null,
          label,
          notes: data.notes ?? null,
          payload: data.payload ?? undefined,
          submittedById: principal.id,
        },
      });

      reply.code(201).send({ feedback: serialise(record) });
    } catch (error) {
      req.log.error({ err: error }, "ml_feedback_persist_failed");
      reply.code(500).send({ error: "storage_failure" });
    }
  });

  app.get("/ml/feedback", async (req: FastifyRequest, reply: FastifyReply) => {
    const principal = await authenticate(req, reply, FEEDBACK_ROLES);
    if (!principal) {
      return;
    }

    const parsed = listQuerySchema.safeParse(req.query ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_query", details: parsed.error.flatten() });
      return;
    }

    const query = parsed.data;
    const where: Record<string, unknown> = { orgId: principal.orgId };

    if (query.modelName) where.modelName = query.modelName;
    if (query.inferenceId) where.inferenceId = query.inferenceId;
    if (query.label) where.label = LABEL_INPUT[query.label];
    if (query.cursor) {
      const cursorDate = new Date(query.cursor);
      if (Number.isNaN(cursorDate.getTime())) {
        reply.code(400).send({ error: "invalid_cursor" });
        return;
      }
      where.createdAt = { lt: cursorDate };
    }

    const records = await client.modelFeedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: query.limit,
    });

    reply.send({
      feedback: records.map(serialise),
      nextCursor: records.length === query.limit ? records[records.length - 1]?.createdAt.toISOString() ?? null : null,
    });
  });
}

export default registerMlFeedbackRoutes;
