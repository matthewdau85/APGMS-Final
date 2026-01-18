import type { FastifyPluginAsync } from 'fastify';

const basPreviewRoutes: FastifyPluginAsync = async (app) => {
  app.get('/bas/preview', async () => {
    const period = { start: '2026-01-01', end: '2026-03-31', label: 'Q3 FY26' };
    const gstOnSales = 18450.00;
    const gstCredits  =  9250.00;
    const paygWithheld = 12100.00;

    const netGST = gstOnSales - gstCredits;
    const netPayable = netGST + paygWithheld;

    return {
      ok: true,
      period,
      lines: [
        { code: '1A', label: 'GST on sales', amount: gstOnSales },
        { code: '1B', label: 'GST credits',  amount: -gstCredits },
        { code: 'W2', label: 'PAYG withheld', amount: paygWithheld },
      ],
      totals: { netGST, netPayable },
      generatedAt: new Date().toISOString()
    };
  });
};

export default basPreviewRoutes;
