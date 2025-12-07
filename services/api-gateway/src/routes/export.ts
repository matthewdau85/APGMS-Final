import { FastifyInstance } from 'fastify';
import { buildBasEvidencePack } from '@apgms/domain-policy/export/evidence';

export async function exportRoutes(fastify: FastifyInstance) {
  fastify.get('/export/bas/v1', {
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
    const pack = await buildBasEvidencePack(orgId, period);
    return reply.send(pack);
  });

  fastify.get('/export/bas.csv', {
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
    const pack = await buildBasEvidencePack(orgId, period);

    const csvLines = [
      'orgId,period,category,amountCents',
      ...Object.entries(pack.ledgerTotals).map(
        ([cat, amount]) =>
          `${pack.orgId},${pack.period},${cat},${amount}`,
      ),
    ];

    reply.header('Content-Type', 'text/csv');
    reply.header(
      'Content-Disposition',
      `attachment; filename="bas-evidence-${period}.csv"`,
    );
    return reply.send(csvLines.join('\n'));
  });
}
