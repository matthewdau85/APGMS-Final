import request from 'supertest';
import { buildApp } from '../src/app';

describe('Regulator compliance summary uses ledger', () => {
  it('returns ledger totals for the requested period', async () => {
    const app = await buildApp();

    // Seed some ledger entries via Prisma client or via a helper/fixture
    // For now assume a helper exists:
    // await seedLedgerForOrgPeriod('org-1', '2025-Q3', { ... });

    const res = await request(app.server)
      .get('/regulator/compliance-summary')
      .set('Authorization', 'Bearer test-admin-token')
      .query({ period: '2025-Q3' })
      .expect(200);

    expect(res.body.period).toBe('2025-Q3');
    expect(res.body.ledgerTotals).toBeDefined();
  });
});
