import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  prisma,
  type PrismaFeedbackRole,
  type StoredFeedback,
} from "../prisma.js";
import { recordFeedbackMetric } from "../metrics.js";

const createFeedbackSchema = z.object({
  predictionId: z.string().min(1, "predictionId is required"),
  modelVersion: z.string().min(1, "modelVersion is required"),
  label: z.string().min(1, "label is required"),
  submittedBy: z.string().min(1, "submittedBy is required"),
  submittedRole: z.enum(["finance", "regulator"]),
  confidence: z.number().min(0).max(1).optional(),
  notes: z.string().max(2048).optional(),
});

const getFeedbackParamsSchema = z.object({
  predictionId: z.string().min(1, "predictionId is required"),
});

type PublicFeedbackRole = "finance" | "regulator";

type FeedbackSummary = {
  counts: Record<string, number>;
};

function toPrismaRole(role: PublicFeedbackRole): PrismaFeedbackRole {
  return role === "finance" ? "FINANCE" : "REGULATOR";
}

function normalizeRole(role: PrismaFeedbackRole): PublicFeedbackRole {
  return role === "FINANCE" ? "finance" : "regulator";
}

function normalizeFeedback(entry: StoredFeedback) {
  return {
    ...entry,
    submittedRole: normalizeRole(entry.submittedRole),
  };
}

export async function registerFeedbackRoutes(app: FastifyInstance) {
  app.post("/feedback", async (request, reply) => {
    const payload = createFeedbackSchema.parse(request.body);

    const record = (await prisma.modelFeedback.create({
      data: {
        predictionId: payload.predictionId,
        modelVersion: payload.modelVersion,
        label: payload.label,
        submittedBy: payload.submittedBy,
        submittedRole: toPrismaRole(payload.submittedRole),
        confidence: payload.confidence,
        notes: payload.notes,
      },
    })) as StoredFeedback;

    recordFeedbackMetric({ role: payload.submittedRole, label: payload.label });

    reply.code(201).send({
      id: record.id,
      createdAt: record.createdAt,
      submittedRole: payload.submittedRole,
    });
  });

  app.get("/feedback/:predictionId", async (request) => {
    const { predictionId } = getFeedbackParamsSchema.parse(request.params);

    const rawEntries = (await prisma.modelFeedback.findMany({
      where: { predictionId },
      orderBy: { createdAt: "desc" },
    })) as StoredFeedback[];

    const entries = rawEntries.map((entry) => normalizeFeedback(entry));

    const counts = entries.reduce<Record<string, number>>((acc, item) => {
      const key = `${item.submittedRole}:${item.label}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const summary: FeedbackSummary = { counts };

    return { predictionId, entries, summary };
  });
}
