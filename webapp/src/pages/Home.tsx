import './Home.css';

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
  return (
    <div className="page">
      <header className="page__header">
        <h1>Portfolio pulse</h1>
        <p>
          Monitor capital utilization, track live mandates, and surface emerging risk signals
          across your institutional banking relationships.
        </p>
      </header>

      <section aria-label="Key metrics">
        <dl className="metric-grid">
          {metrics.map((metric, index) => {
            const changeId = `metric-${index}-change`;

            return (
              <div className="metric-card" key={metric.title}>
                <div className="metric-card__header">
                  <dt className="metric-card__title">{metric.title}</dt>
                  <dd className="metric-card__change">
                    <span className="metric-card__change-badge" aria-hidden="true">
                      {metric.change}
                    </span>
                    <span className="sr-only" id={changeId}>
                      Change for {metric.title}: {metric.change}
                    </span>
                  </dd>
                </div>
                <dd aria-describedby={changeId} className="metric-card__value">
                  {metric.value}
                </dd>
                <dd className="metric-card__description">{metric.description}</dd>
              </div>
            );
          })}
        </dl>
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
