import './Home.css';
import { useRiskSnapshot } from '../useRiskSnapshot';

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

export default function HomePage() {
  const { risk, error: riskError, loading: riskLoading } = useRiskSnapshot();

  const renderRiskCard = (title: string, key: "shortfall" | "fraud") => {
    if (!risk) return null;
    const score = risk[key];
    const topExplanation = score.top_explanations[0];
    return (
      <article className="risk-card" key={key}>
        <header className={`risk-card__header risk-card__header--${score.risk_level}`}>
          <div>
            <h3>{title}</h3>
            <p className="risk-card__score">{(score.score * 100).toFixed(1)}% risk</p>
          </div>
          <span className="risk-card__badge">{score.risk_level.toUpperCase()}</span>
        </header>
        {topExplanation && (
          <p className="risk-card__explanation">
            <strong>Driver:</strong> {topExplanation.rationale}
          </p>
        )}
        <ul className="risk-card__mitigations">
          {score.mitigations.slice(0, 2).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </article>
    );
  };

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


      <section aria-label="Risk insights" className="risk-insights">
        <div className="risk-insights__header">
          <h2>Risk insights</h2>
          <p>Machine learning scores highlight BAS readiness and fraud posture in real time.</p>
        </div>
        {riskLoading && <p className="risk-insights__status">Loading risk insights...</p>}
        {riskError && !riskLoading && (
          <p className="risk-insights__status risk-insights__status--error">{riskError}</p>
        )}
        {!riskLoading && !riskError && risk && (
          <div className="risk-insights__grid">
            {renderRiskCard("BAS shortfall probability", "shortfall")}
            {renderRiskCard("Fraud screening posture", "fraud")}
          </div>
        )}
        {!riskLoading && !riskError && !risk && (
          <p className="risk-insights__status">No risk data available.</p>
        )}
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
