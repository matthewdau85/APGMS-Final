import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';

import BankLinesPage from '../pages/BankLines';

const ResponseCtor = globalThis.Response;

const sampleLedgerResponse = {
  blocked: false,
  warning: 'ledger_reconciliation_medium',
  risk: {
    modelVersion: '2025.02',
    riskScore: 0.68,
    riskLevel: 'medium',
    recommendedMitigations: [
      'Escalate treasury review for PAYGW coverage.',
      'Trigger contingency funding plan before lodgment.'
    ],
    explanation: 'Coverage trending lower across GST buffers.',
    contributingFactors: []
  }
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('/risk/ledger-reconciliation')) {
      return new ResponseCtor(JSON.stringify(sampleLedgerResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new ResponseCtor('{}', { status: 404 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('renders ML ledger insights with recommended mitigations', async () => {
  render(<BankLinesPage />);

  expect(await screen.findByText('Ledger reconciliation insights')).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByText(/Risk score:/)).toHaveTextContent('0.68');
  });
  expect(
    screen.getByText('Escalate treasury review for PAYGW coverage.')
  ).toBeInTheDocument();
  expect(
    screen.getByText('Trigger contingency funding plan before lodgment.')
  ).toBeInTheDocument();
});
