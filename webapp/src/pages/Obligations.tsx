import './Obligations.css';

import type { ReactNode } from 'react';

type StatusBadgeVariant = 'active' | 'monitoring' | 'pending';

type StatusBadgeProps = {
  variant: StatusBadgeVariant;
  label: string;
  description: string;
};

function StatusBadge({ variant, label, description }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${variant}`}>
      <span className="status-badge__label">{label}</span>
      <span className="status-badge__description">{description}</span>
    </span>
  );
}

type MetricTrend = 'positive' | 'negative' | 'neutral';

type MetricCard = {
  id: string;
  title: string;
  value: string;
  sublabel: ReactNode;
  trend: MetricTrend;
};

const metrics: MetricCard[] = [
  {
    id: 'paygw',
    title: 'PAYGW secured vs liability',
    value: '$245k',
    sublabel: '92% of the $266k obligation secured across trust accounts',
    trend: 'positive'
  },
  {
    id: 'gst',
    title: 'GST secured vs liability',
    value: '$198k',
    sublabel: '86% of the $231k remittance covered by reserve',
    trend: 'positive'
  },
  {
    id: 'variance',
    title: 'Variance',
    value: '-$18.5k',
    sublabel: 'Movement since the prior BAS lodgement window',
    trend: 'negative'
  },
  {
    id: 'next-bas',
    title: 'Next BAS due',
    value: '30 Oct 2024',
    sublabel: 'Preparation window open • CFO sign-off scheduled in 14 days',
    trend: 'neutral'
  }
];

export default function ObligationsPage() {
  return (
    <div className="obligations">
      <header className="obligations__header">
        <div className="obligations__summary">
          <h1>Obligation control room</h1>
          <p>
            Monitor statutory lodgements, withheld tax positions, and trust account coverage to
            keep compliance teams aligned on upcoming remittances.
          </p>
        </div>
        <div className="obligations__posture" aria-label="Overall compliance posture">
          <span className="obligations__posture-label">Compliance posture</span>
          <StatusBadge
            variant="active"
            label="On track"
            description="All lodgements secured and reconciled"
          />
        </div>
      </header>

      <section className="obligations__metrics" aria-label="Obligation metrics">
        {metrics.map((metric) => (
          <article className="obligations-metric-card" key={metric.id}>
            <header className="obligations-metric-card__header">
              <h2>{metric.title}</h2>
            </header>
            <p className="obligations-metric-card__value">{metric.value}</p>
            <p className="obligations-metric-card__sublabel">{metric.sublabel}</p>
            <div
              className={`obligations-metric-card__sparkline obligations-metric-card__sparkline--${metric.trend}`}
              aria-hidden="true"
            />
          </article>
        ))}
      </section>
    </div>
  );
}
