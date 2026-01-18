import type { FastifyPluginAsync } from 'fastify';

type DesignatedAccount = {
  id: string;
  name: string;
  bsb: string;
  accountNumberMasked: string;
  balance: number;
  status: 'ok'|'shortfall';
};

const sample: DesignatedAccount[] = [
  { id: 'd1', name: 'PAYGW Trust', bsb: '123-456', accountNumberMasked: '***1234', balance: 12500.00, status: 'ok' },
  { id: 'd2', name: 'GST Trust',   bsb: '123-789', accountNumberMasked: '***5678', balance:  2200.00, status: 'shortfall' },
];

const designatedRoutes: FastifyPluginAsync = async (app) => {
  app.get('/designated-accounts', async () => {
    return { items: sample, total: sample.length, asAt: new Date().toISOString() };
  });
};

export default designatedRoutes;
