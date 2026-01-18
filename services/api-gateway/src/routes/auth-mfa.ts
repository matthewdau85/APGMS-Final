import type { FastifyPluginAsync } from 'fastify';

const authMfaRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { email?: string; phone?: string } }>('/auth/mfa/initiate', async (req, reply) => {
    const { email, phone } = req.body || {};
    const channel = email ? 'email' : phone ? 'sms' : null;
    if (!channel) return reply.code(400).send({ ok: false, error: 'missing_contact' });
    return { ok: true, sent: true, channel, ttlSeconds: 300 };
  });
};

export default authMfaRoutes;
