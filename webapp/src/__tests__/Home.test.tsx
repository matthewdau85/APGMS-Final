import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';

import HomePage from '../pages/Home';

const ResponseCtor = globalThis.Response;

const sampleFraudResponse = {
  blocked: true,
  warning: 'fraud_screen_medium',
  risk: {
    modelVersion: '2025.01',
    riskScore: 0.81,
    riskLevel: 'high',
    recommendedMitigations: [
      'Hold payout pending secondary verification.',
      'Notify fraud operations for manual review.'
    ],
    explanation: 'Velocity and channel risk exceed treasury thresholds.',
    contributingFactors: []
  }
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('/risk/fraud-screen')) {
      return new ResponseCtor(JSON.stringify(sampleFraudResponse), {
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

test('exposes fraud screening mitigations and block status', async () => {
  render(<HomePage />);

  expect(await screen.findByText('Fraud screening highlights')).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByText(/Risk score:/)).toHaveTextContent('0.81');
  });
  expect(screen.getByText('Hold payout pending secondary verification.')).toBeInTheDocument();
  expect(screen.getByText('Transaction hold enforced until a senior approver clears the payout.')).toBeInTheDocument();
});
