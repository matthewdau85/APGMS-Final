import { useEffect, useMemo, useState } from 'react';

import './BankLines.css';
import {
  evaluateLedgerReconciliationRisk,
  type LedgerRiskPayload,
  type MlRiskSummary,
} from '../api';

type LineStatus = 'Active' | 'Pending' | 'Monitoring';

type BankLine = {
  bank: string;
  limit: string;
  utilization: string;
  status: LineStatus;
  updated: string;
  notes: string;
};

const bankLines: BankLine[] = [
  {
    bank: 'Commonwealth Bank',
    limit: '$1.2B',
    utilization: '64%',
    status: 'Active',
    updated: 'Today 10:24',
    notes: 'Term sheet expansion approved for Helios storage facility.'
  },
  {
    bank: 'Northwind Credit Union',
    limit: '$820M',
    utilization: '71%',
    status: 'Monitoring',
    updated: 'Yesterday',
    notes: 'Utilization trending upward ahead of portfolio rebalance.'
  },
  {
    bank: 'First Harbor Partners',
    limit: '$640M',
    utilization: '48%',
    status: 'Pending',
    updated: '2 days ago',
    notes: 'Awaiting revised covenants from legal after counterparty feedback.'
  }
];

const statusLabels: Record<LineStatus, string> = {
  Active: 'Operational',
  Pending: 'Requires approval',
  Monitoring: 'Watch closely'
};

type LedgerInsightState = {
  loading: boolean;
  data: { blocked: boolean; warning?: string; risk: MlRiskSummary } | null;
  error?: string;
};

const fallbackInsight: LedgerInsightState['data'] = {
  blocked: false,
  warning: 'ledger_reconciliation_medium',
  risk: {
    modelVersion: '2025.02-fallback',
    riskScore: 0.52,
    riskLevel: 'medium',
    recommendedMitigations: [
      'Tighten daily reconciliation thresholds until live signals stabilise.',
      'Escalate unresolved bank feed variances to the treasury desk before BAS cut-off.'
    ],
    explanation: 'Using cached heuristics because the ML service is offline.',
    contributingFactors: []
  }
};

function parseCurrency(value: string): number {
  const normalized = value.replace(/[^0-9.]/g, '');
  const magnitude = value.includes('B') ? 1_000_000_000 : value.includes('M') ? 1_000_000 : 1;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed * magnitude : 0;
}

function parsePercentage(value: string): number {
  const parsed = Number.parseFloat(value.replace('%', ''));
  return Number.isFinite(parsed) ? parsed / 100 : 0;
}

export default function BankLinesPage() {
  const [insight, setInsight] = useState<LedgerInsightState>({ loading: true, data: null });

  const ledgerPayload = useMemo<LedgerRiskPayload>(() => {
    const totalLimit = bankLines.reduce((sum, line) => sum + parseCurrency(line.limit), 0);
    const totalExposure = bankLines.reduce(
      (sum, line) => sum + parseCurrency(line.limit) * parsePercentage(line.utilization),
      0
    );
    const securedPercentage = totalLimit > 0 ? Math.min(1, totalExposure / totalLimit) : 0;
    return {
      orgId: 'demo-ledger',
      totalExposure,
      securedPercentage,
      varianceAmount: totalExposure * 0.02,
      unreconciledEntries: 3,
      basWindowDays: 5
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await evaluateLedgerReconciliationRisk(ledgerPayload);
        if (!cancelled) {
          setInsight({ loading: false, data: response });
        }
      } catch (error) {
        console.error('ledger-risk-fallback', error);
        if (!cancelled) {
          setInsight({
            loading: false,
            data: fallbackInsight,
            error: 'Using cached risk insights while the ML service is unavailable.'
          });
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [ledgerPayload]);

  const riskLevelLabel = insight.data?.risk.riskLevel ?? 'loading';
  const formattedScore = insight.data ? insight.data.risk.riskScore.toFixed(2) : '0.00';

  return (
    <div className="bank-lines">
      <header className="bank-lines__header">
        <div>
          <h1>Bank line visibility</h1>
          <p>
            Stay ahead of liquidity requirements with a consolidated view of commitments, live
            utilization, and watchlist signals across your institutional lenders.
          </p>
        </div>
        <button type="button" className="bank-lines__cta">
          Export exposure report
        </button>
      </header>

      <div className="bank-lines__table-wrapper">
        <table>
          <caption className="sr-only">Breakdown of bank line utilization and statuses</caption>
          <thead>
            <tr>
              <th scope="col">Lender</th>
              <th scope="col">Limit</th>
              <th scope="col">Utilization</th>
              <th scope="col">Status</th>
              <th scope="col">Updated</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {bankLines.map((line) => (
              <tr key={line.bank}>
                <th scope="row">{line.bank}</th>
                <td>{line.limit}</td>
                <td>
                  <div className="bank-lines__utilization">
                    <span>{line.utilization}</span>
                    <div className="bank-lines__utilization-track" aria-hidden="true">
                      <div
                        className="bank-lines__utilization-fill"
                        style={{ width: line.utilization }}
                      />
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`status-badge status-badge--${line.status.toLowerCase()}`}>
                    <span className="status-badge__label">{line.status}</span>
                    <span className="status-badge__hint">{statusLabels[line.status]}</span>
                  </span>
                </td>
                <td>{line.updated}</td>
                <td>{line.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="bank-lines__insights" aria-live="polite">
        <header className="bank-lines__insights-header">
          <div>
            <h2>Ledger reconciliation insights</h2>
            <p>
              Model-driven signals surface emerging BAS exposure risk and suggest mitigations before
              lodgment cut-offs.
            </p>
          </div>
          <span className={`bank-lines__risk-pill bank-lines__risk-pill--${riskLevelLabel}`}>
            {insight.data ? insight.data.risk.riskLevel.toUpperCase() : 'LOADING'}
          </span>
        </header>

        {insight.loading && <p>Running ML inference across designated accounts…</p>}

        {insight.data && (
          <div className="bank-lines__insights-body">
            <p className="bank-lines__insights-score">
              Risk score: <strong>{formattedScore}</strong> (model {insight.data.risk.modelVersion})
            </p>
            <p className="bank-lines__insights-explanation">{insight.data.risk.explanation}</p>
            {insight.data.warning && (
              <p className="bank-lines__insights-warning">
                {insight.data.warning === 'ledger_reconciliation_medium'
                  ? 'Variance is trending upward. Increase reconciliation cadence before BAS submission.'
                  : insight.data.warning}
              </p>
            )}
            {insight.data.blocked && (
              <p className="bank-lines__insights-blocked">
                Action blocked: ledger reconciliation requires treasury approval because the model
                flagged a high shortfall risk.
              </p>
            )}
            <h3>Recommended mitigations</h3>
            <ul className="bank-lines__mitigations">
              {insight.data.risk.recommendedMitigations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {insight.error && <p className="bank-lines__insights-note">{insight.error}</p>}
      </section>
    </div>
  );
}
