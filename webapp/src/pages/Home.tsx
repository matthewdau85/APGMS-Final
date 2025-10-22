import './Home.css';
import { VarianceBadge } from '../components/VarianceBadge';
import { PaygwGauge } from '../components/PaygwGauge';
import { DeadlineCapsule } from '../components/DeadlineCapsule';
import { useKpiStore, useMetricList, type VarianceTone } from '../store/useKpiStore';

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

const resolveTone = (change: string): VarianceTone => {
  const trimmed = change.trim();
  if (trimmed.startsWith('-')) {
    return 'negative';
  }
  if (trimmed.startsWith('+')) {
    return 'positive';
  }
  return 'neutral';
};

export default function HomePage() {
  const metrics = useMetricList();
  const paygwCompliance = useKpiStore((state) => state.paygwCompliance);
  const paygwVariance = useKpiStore((state) => state.paygwVariance);
  const basLodgmentDays = useKpiStore((state) => state.basLodgmentDays);

  return (
    <div className="page">
      <header className="page__header">
        <h1>Portfolio pulse</h1>
        <p>
          Monitor capital utilization, track live mandates, and surface emerging risk signals across your
          institutional banking relationships.
        </p>
      </header>

      <section aria-label="Key metrics" className="metric-grid">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.id}>
            <header className="metric-card__header">
              <h2>{metric.title}</h2>
              <VarianceBadge tone={resolveTone(metric.change)}>{metric.change}</VarianceBadge>
            </header>
            <p className="metric-card__value">{metric.value}</p>
            <p className="metric-card__description">{metric.description}</p>
          </article>
        ))}
      </section>

      <section aria-label="PAYGW compliance" className="compliance">
        <div className="compliance__body">
          <PaygwGauge value={paygwCompliance} />
          <div className="compliance__details">
            <div className="compliance__badges">
              <VarianceBadge tone={paygwVariance.tone}>{paygwVariance.label}</VarianceBadge>
              <DeadlineCapsule daysRemaining={basLodgmentDays} label="Until BAS lodgment" />
            </div>
            <h2>PAYGW remittance health</h2>
            <p>
              Real-time withholding compliance is trending above baseline. Exceptions flagged by payroll
              automations have dropped this cycle, keeping the team ahead of ATO lodgment requirements.
            </p>
          </div>
        </div>
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
