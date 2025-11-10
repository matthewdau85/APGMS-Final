import { useEffect, useState } from 'react';

import './Home.css';
import {
  evaluateFraudScreening,
  type FraudScreenPayload,
  type MlRiskSummary,
} from '../api';

const metrics = [
  {
    title: 'Active mandates',
    value: '24',
    change: '+3.4% vs last week',
    description:
      'Structured credit and private equity deals currently tracked in the Pro+ workspace.'
  },
  {
    title: 'Total committed capital',
    value: '$4.8B',
    change: '+$180M new commitments',
    description: 'Aggregate bank and fund lines allocated across open portfolios.'
  },
  {
    title: 'Average utilization',
    value: '67%',
    change: '-5.3% risk exposure',
    description: 'Weighted utilization across all active bank lines for the current quarter.'
  }
];

const activities = [
  {
    name: 'GreenRidge solar expansion',
    detail: 'Closing diligence with Commonwealth Bank',
    status: 'Due tomorrow'
  },
  {
    name: 'Helios storage facility',
    detail: 'Amended terms shared with syndicate partners',
    status: 'Updated 2h ago'
  },
  {
    name: 'Urban mobility fund II',
    detail: 'Capital call scheduled for Monday',
    status: 'Action needed'
  }
];

type FraudInsightState = {
  loading: boolean;
  data: { blocked: boolean; warning?: string; risk: MlRiskSummary } | null;
  error?: string;
};

const fallbackFraudInsight: FraudInsightState['data'] = {
  blocked: true,
  warning: 'fraud_screen_medium',
  risk: {
    modelVersion: '2025.01-fallback',
    riskScore: 0.71,
    riskLevel: 'high',
    recommendedMitigations: [
      'Hold disbursement until treasury verifies counterparty credentials.',
      'Escalate to fraud operations for manual review within 1 hour.'
    ],
    explanation: 'Using cached heuristics while fraud screening service is offline.',
    contributingFactors: []
  }
};

export default function HomePage() {
  const [fraudInsight, setFraudInsight] = useState<FraudInsightState>({ loading: true, data: null });

  useEffect(() => {
    let cancelled = false;
    const payload: FraudScreenPayload = {
      transactionId: 'txn-synthetic-1',
      amount: 125_000,
      channelRisk: 0.82,
      velocity: 4.2,
      geoDistance: 1750,
      accountTenureDays: 42,
      previousIncidents: 1
    };

    const load = async () => {
      try {
        const response = await evaluateFraudScreening(payload);
        if (!cancelled) {
          setFraudInsight({ loading: false, data: response });
        }
      } catch (error) {
        console.error('fraud-screen-fallback', error);
        if (!cancelled) {
          setFraudInsight({
            loading: false,
            data: fallbackFraudInsight,
            error: 'Fraud ML service unreachable — using cached guardrails.'
          });
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const fraudScore = fraudInsight.data ? fraudInsight.data.risk.riskScore.toFixed(2) : '0.00';

  return (
    <div className="page">
      <header className="page__header">
        <h1>Portfolio pulse</h1>
        <p>
          Monitor capital utilization, track live mandates, and surface emerging risk signals
          across your institutional banking relationships.
        </p>
      </header>

      <section aria-label="Key metrics" className="metric-grid">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.title}>
            <header className="metric-card__header">
              <h2>{metric.title}</h2>
              <span className="metric-card__change">{metric.change}</span>
            </header>
            <p className="metric-card__value">{metric.value}</p>
            <p className="metric-card__description">{metric.description}</p>
          </article>
        ))}
      </section>

      <section aria-label="Latest activity" className="activity">
        <div className="activity__header">
          <h2>Workflow alerts</h2>
          <p className="activity__subtitle">Curated tasks across deal teams and syndicate partners</p>
        </div>
        <ul className="activity__list">
          {activities.map((activity) => (
            <li className="activity__item" key={activity.name}>
              <div>
                <p className="activity__name">{activity.name}</p>
                <p className="activity__detail">{activity.detail}</p>
              </div>
              <span className="activity__status">{activity.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="fraud-insights" aria-live="polite">
        <header className="fraud-insights__header">
          <div>
            <h2>Fraud screening highlights</h2>
            <p>
              Real-time inference flags anomalous payments before funds leave designated accounts.
            </p>
          </div>
          <span className={`fraud-insights__pill fraud-insights__pill--${fraudInsight.data?.risk.riskLevel ?? 'loading'}`}>
            {fraudInsight.data ? fraudInsight.data.risk.riskLevel.toUpperCase() : 'LOADING'}
          </span>
        </header>

        {fraudInsight.loading && <p>Scoring priority payments and ledger holds…</p>}

        {fraudInsight.data && (
          <div className="fraud-insights__body">
            <p className="fraud-insights__score">
              Risk score: <strong>{fraudScore}</strong> (model {fraudInsight.data.risk.modelVersion})
            </p>
            <p className="fraud-insights__explanation">{fraudInsight.data.risk.explanation}</p>
            {fraudInsight.data.warning && (
              <p className="fraud-insights__warning">
                {fraudInsight.data.warning === 'fraud_screen_medium'
                  ? 'Analyst review recommended: velocity and channel risk exceed treasury guardrails.'
                  : fraudInsight.data.warning}
              </p>
            )}
            {fraudInsight.data.blocked && (
              <p className="fraud-insights__blocked">
                Transaction hold enforced until a senior approver clears the payout.
              </p>
            )}
            <h3>Next best actions</h3>
            <ul className="fraud-insights__mitigations">
              {fraudInsight.data.risk.recommendedMitigations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {fraudInsight.error && <p className="fraud-insights__note">{fraudInsight.error}</p>}
      </section>
    </div>
  );
}
