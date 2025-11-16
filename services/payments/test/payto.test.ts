import {
  createDefaultBankProviders,
  DesignatedAccountOrchestrator,
  InMemoryDesignatedAccountRepository,
  MultiBankPayToService,
} from '../src/index.ts';

function buildOrchestrator() {
  const service = new MultiBankPayToService(createDefaultBankProviders());
  const repo = new InMemoryDesignatedAccountRepository();
  return new DesignatedAccountOrchestrator(repo, service);
}

describe('DesignatedAccountOrchestrator', () => {
  it('blocks transfers until mandates are activated', async () => {
    const orchestrator = buildOrchestrator();
    const account = await orchestrator.createAccount({
      orgId: 'org-123',
      bank: 'CBA',
      bsb: '123-456',
      accountNumber: '12345678',
      obligation: 'PAYGW',
    });

    await expect(
      orchestrator.initiateTransfer(account.id, 1000, 'DEPOSIT'),
    ).rejects.toThrow('Transfers are blocked');

    await orchestrator.activateMandate(account.id);
    await expect(
      orchestrator.initiateTransfer(account.id, 1000, 'DEPOSIT'),
    ).resolves.toEqual(
      expect.objectContaining({ status: 'SETTLED', direction: 'DEPOSIT' }),
    );
  });

  it.each([
    ['NAB'],
    ['ANZ'],
  ])('enforces deposit-only accounts for %s', async (bank) => {
    const orchestrator = buildOrchestrator();
    const account = await orchestrator.createAccount({
      orgId: 'org-123',
      bank: bank as 'NAB' | 'ANZ',
      bsb: '123-456',
      accountNumber: '12345678',
      obligation: 'GST',
    });

    expect(account.depositOnly).toBe(true);

    await orchestrator.activateMandate(account.id);
    await expect(
      orchestrator.initiateTransfer(account.id, 1500, 'DEPOSIT'),
    ).resolves.toEqual(
      expect.objectContaining({ status: 'SETTLED', direction: 'DEPOSIT' }),
    );

    await expect(
      orchestrator.initiateTransfer(account.id, 200, 'WITHDRAW'),
    ).rejects.toThrow('deposit-only');
  });
});
