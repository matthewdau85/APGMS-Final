import { FastifyInstance } from 'fastify';
import { prepareBasSettlementInstruction } from '@apgms/domain-policy/settlement/bas-settlement';

export async function basSettlementRoutes(fastify: FastifyInstance) {
  fastify.post('/settlements/bas/finalise', {
    schema: {
      body: {
        type: 'object',
        required: ['period'],
        properties: {
          period: { type: 'string' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            instructionId: { type: 'string' },
            payload: { type: 'object' },
          },
        },
      },
    },
    // add auth/authz config as you do for admin routes
  }, async (request, reply) => {
    const orgId = request.org.orgId;
    const { period } = request.body as { period: string };

    const { payload, record } = await prepareBasSettlementInstruction(orgId, period);

    // In future: send to real PayTo adapter.
    // For now, just log & leave status=PREPARED
    request.log.info({ payload }, 'Prepared BAS settlement');

    return reply.code(201).send({
      instructionId: record.id,
      payload,
    });
  });
}
