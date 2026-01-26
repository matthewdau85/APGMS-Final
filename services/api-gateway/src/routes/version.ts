import type { FastifyInstance } from 'fastify';

const SERVICE_NAME = 'api-gateway';

export function registerVersionRoutes(app: FastifyInstance) {
  app.get('/version', async (_req, reply) => {
    const gitSha = process.env.GIT_SHA ?? 'dev';
    const buildTs = process.env.BUILD_TS ?? new Date().toISOString();
    const env = process.env.NODE_ENV ?? 'development';
    const mode = process.env.APGMS_MODE ?? 'unknown';

    reply.send({
      ok: true,
      gitSha,
      buildTs,
      node: process.version,
      env,
      mode,
      service: SERVICE_NAME,
    });
  });
}
