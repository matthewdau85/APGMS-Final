import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { recordFeedbackMetric } from '../observability/metrics.js';
import { modelManifest } from '../config/modelManifest.js';

const feedbackSchema = z.object({
  modelId: z.string(),
  modelVersion: z.string(),
  predictionId: z.string(),
  label: z.enum(['FALSE_POSITIVE', 'FALSE_NEGATIVE']),
  submittedBy: z.string(),
  source: z.enum(['REGULATOR', 'FINANCE']).default('REGULATOR'),
  notes: z.string().max(2000).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  observedAt: z.string().datetime().optional(),
});

export const feedbackPlugin: FastifyPluginAsync = async (app) => {
  app.post('/feedback', async (request, reply) => {
    const parsed = feedbackSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return {
        message: 'Invalid feedback payload',
        issues: parsed.error.flatten(),
      };
    }

    const payload = parsed.data;
    if (payload.modelId !== modelManifest.modelId || payload.modelVersion !== modelManifest.version) {
      reply.status(409);
      return {
        message: 'Model version mismatch for feedback',
        expected: { id: modelManifest.modelId, version: modelManifest.version },
      };
    }

    const record = await prisma.modelFeedback.create({
      data: {
        modelId: payload.modelId,
        modelVersion: payload.modelVersion,
        predictionId: payload.predictionId,
        label: payload.label,
        source: payload.source,
        submittedBy: payload.submittedBy,
        submittedAt: payload.observedAt ? new Date(payload.observedAt) : undefined,
        notes: payload.notes,
        metadata: payload.metadata,
      },
    });

    recordFeedbackMetric(record.modelId, record.modelVersion, record.label, record.source);

    reply.status(201);
    return {
      id: record.id,
      recordedAt: record.createdAt,
    };
  });

  app.get('/feedback', async (request, reply) => {
    const querySchema = z
      .object({
        modelId: z.string().optional(),
        label: z.enum(['FALSE_POSITIVE', 'FALSE_NEGATIVE']).optional(),
        source: z.enum(['REGULATOR', 'FINANCE']).optional(),
        limit: z.coerce.number().min(1).max(100).default(20),
      })
      .optional();
    const queryResult = querySchema.safeParse(request.query);
    if (!queryResult.success) {
      reply.status(400);
      return {
        message: 'Invalid query parameters',
        issues: queryResult.error.flatten(),
      };
    }

    const { modelId, label, source, limit } = queryResult.data ?? {};
    const feedback = await prisma.modelFeedback.findMany({
      where: {
        modelId: modelId ?? undefined,
        label: label ?? undefined,
        source: source ?? undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return feedback;
  });
};
