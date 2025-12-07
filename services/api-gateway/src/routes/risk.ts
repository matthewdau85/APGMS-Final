import { FastifyInstance } from 'fastify';
import { computeOrgRisk } from '@apgms/domain-policy/risk/anomaly';

export async function riskRoutes(fastify: FastifyInstance) {
  fastify.get('/risk/summary', {
    schema: {
      querystring: {
        type: 'object',
        required: ['period'],
        properties: { period: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const orgId = request.org.orgId;
    const { period } = request.query as { period: string };

    const snapshot = await computeOrgRisk(orgId, period);

    // Expose as metric
    fastify.metrics?.observeGauge(
      'apgms_org_risk_score',
      snapshot.overallLevel === 'LOW' ? 1 : snapshot.overallLevel === 'MEDIUM' ? 2 : 3,
      { orgId, period },
    );

    return reply.send(snapshot);
  });
}
