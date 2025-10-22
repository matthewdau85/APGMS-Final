import './Home.css';
import { fmtCurrency, fmtPct, trendColor } from '../lib/format';

type Metric = {
  title: string;
  value: number;
  description: string;
  valueFormatter?: (value: number) => string;
  change?: {
    delta: number;
    suffix?: string;
    formatter?: (value: number) => string;
  };
};

const metrics: Metric[] = [
  {
    title: 'Active mandates',
    value: 24,
    change: {
      delta: 3.4,
      suffix: 'vs last week',
      formatter: (value) => fmtPct(value, 1)
    },
    description:
      'Structured credit and private equity deals currently tracked in the Pro+ workspace.'
  },
  {
    title: 'Total committed capital',
    value: 4_800_000_000,
    valueFormatter: fmtCurrency,
    change: {
      delta: 180_000_000,
      suffix: 'new commitments',
      formatter: fmtCurrency
    },
    description: 'Aggregate bank and fund lines allocated across open portfolios.'
  },
  {
    title: 'Average utilization',
    value: 67,
    valueFormatter: (value) => fmtPct(value, 0),
    change: {
      delta: -5.3,
      suffix: 'risk exposure',
      formatter: fmtPct
    },
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

export default function HomePage() {
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
        {metrics.map((metric) => {
          const valueFormatter =
            metric.valueFormatter ?? ((value: number) => value.toLocaleString('en-AU'));
          const change = metric.change;
          const changeContent = change
            ? `${change.delta >= 0 ? '+' : '−'}${
                change.formatter
                  ? change.formatter(Math.abs(change.delta))
                  : Math.abs(change.delta).toLocaleString('en-AU')
              }${change.suffix ? ` ${change.suffix}` : ''}`
            : null;

          return (
            <article className="metric-card" key={metric.title}>
              <header className="metric-card__header">
                <h2>{metric.title}</h2>
                {change && changeContent ? (
                  <span className={`metric-card__change ${trendColor(change.delta)}`}>
                    {changeContent}
                  </span>
                ) : null}
              </header>
              <p className="metric-card__value">{valueFormatter(metric.value)}</p>
              <p className="metric-card__description">{metric.description}</p>
            </article>
          );
        })}
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
    </div>
  );
}
