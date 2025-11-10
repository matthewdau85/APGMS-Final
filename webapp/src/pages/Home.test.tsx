import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import HomePage from './Home';

vi.mock('../useRiskSnapshot', () => ({
  useRiskSnapshot: vi.fn(),
}));

import { useRiskSnapshot as useRiskSnapshotOriginal } from '../useRiskSnapshot';
const useRiskSnapshot = vi.mocked(useRiskSnapshotOriginal);

const sampleRisk = {
  shortfall: {
    model: 'shortfall',
    score: 0.52,
    threshold: 0.62,
    risk_level: 'medium' as const,
    exceeds_threshold: false,
    mitigations: ['Rebalance escrow reserves', 'Schedule mid-cycle reconciliation'],
    top_explanations: [
      {
        name: 'obligations_due',
        value: 1.2,
        weight: 1.1,
        impact: 1.32,
        rationale: 'Large upcoming BAS liabilities increase the risk profile.',
        mitigation: 'Stage a top-up of the PAYGW escrow account.',
      },
    ],
  },
  fraud: {
    model: 'fraud',
    score: 0.18,
    threshold: 0.58,
    risk_level: 'low' as const,
    exceeds_threshold: false,
    mitigations: ['Maintain standard dual approval process'],
    top_explanations: [
      {
        name: 'device_trust_score',
        value: 0.9,
        weight: -1.1,
        impact: -0.99,
        rationale: 'Most transfers originate from trusted devices.',
        mitigation: 'Continue enforcing device posture checks.',
      },
    ],
  },
};

describe('HomePage risk insights', () => {
  afterEach(() => {
    useRiskSnapshot.mockReset();
  });

  it('renders ML risk cards when data is available', async () => {
    useRiskSnapshot.mockReturnValue({ risk: sampleRisk, error: null, loading: false, refresh: vi.fn() });

    render(<HomePage />);

    expect(screen.getByText('BAS shortfall probability')).toBeInTheDocument();
    expect(screen.getByText('52.0% risk')).toBeInTheDocument();
    expect(screen.getByText(/Machine learning scores/i)).toBeInTheDocument();
  });

  it('displays failure state when risk snapshot fails', () => {
    useRiskSnapshot.mockReturnValue({ risk: null, error: 'Risk service unavailable', loading: false, refresh: vi.fn() });

    render(<HomePage />);

    expect(screen.getByText('Risk service unavailable')).toBeInTheDocument();
  });
});
