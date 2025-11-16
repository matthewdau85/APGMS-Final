import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const createMigrationBody = z.object({
  orgId: z.string().uuid(),
  sourceSystem: z.enum(['gusto', 'adp', 'paychex', 'square', 'toast']),
  targetLedger: z.enum(['netsuite', 'quickbooks', 'sage-intacct']),
  dryRun: z.boolean().default(false),
});

const migrationResponse = z.object({
  migrationId: z.string().uuid(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  startedAt: z.string(),
});

const webhookBody = z.object({
  url: z.string().url(),
  events: z.array(z.enum(['migration.started', 'migration.completed', 'migration.failed'])).nonempty(),
});

export function onboardingRoutes(app: FastifyInstance, _opts: unknown, done: () => void): void {
  app.post('/migrations', async (request, reply) => {
    const body = createMigrationBody.parse(request.body);
    const response = migrationResponse.parse({
      migrationId: crypto.randomUUID(),
      status: body.dryRun ? 'pending' : 'running',
      startedAt: new Date().toISOString(),
    });

    return reply.code(202).send(response);
  });

  app.post('/webhooks', async (request, reply) => {
    const body = webhookBody.parse(request.body);
    app.log.info({ webhook: body.url }, 'configured webhook');
    return reply.code(201).send({ ok: true });
  });

  done();
}
