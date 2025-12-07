import { FastifyInstance } from 'fastify';
// import domain mapping helper once you write it

export async function connectorsBankRoutes(fastify: FastifyInstance) {
  fastify.post('/connectors/bank/xero-csv', {
    schema: {
      consumes: ['text/csv'],
      body: { type: 'string' }, // raw CSV
    },
  }, async (request, reply) => {
    const orgId = request.org.orgId;
    const csvBody = request.body as string;

    // TODO: implement mapping to bank-lines + ledger
    // await importXeroBankCsv(orgId, csvBody);

    request.log.info({ orgId }, 'Received Xero bank CSV');
    return reply.code(202).send({ status: 'ACCEPTED' });
  });
}
