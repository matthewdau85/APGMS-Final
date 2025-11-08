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
    deadline: {
      display: 'Due tomorrow',
      dateTime: '2024-06-21',
      ariaLabel: 'GreenRidge solar expansion is due tomorrow'
    },
    status: 'Awaiting credit sign-off'
  },
  {
    name: 'Helios storage facility',
    detail: 'Amended terms shared with syndicate partners',
    deadline: {
      display: 'Updated 2h ago',
      dateTime: '2024-06-20T14:00:00Z',
      ariaLabel: 'Helios storage facility updated two hours ago'
    },
    status: 'Review revised syndicate comments'
  },
  {
    name: 'Urban mobility fund II',
    detail: 'Capital call scheduled for Monday',
    deadline: {
      display: 'Due Monday',
      dateTime: '2024-06-24',
      ariaLabel: 'Urban mobility fund II due on Monday'
    },
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
          {activities.map((activity, index) => {
            const titleId = `activity-name-${index}`;
            const detailId = `activity-detail-${index}`;
            const statusId = `activity-status-${index}`;

            return (
              <li className="activity__item" key={activity.name}>
                <article
                  className="activity__card"
                  aria-labelledby={titleId}
                  aria-describedby={`${detailId} ${statusId}`}
                >
                  <div className="activity__summary">
                    <p className="activity__name" id={titleId}>
                      {activity.name}
                    </p>
                    <time
                      className="activity__deadline"
                      dateTime={activity.deadline.dateTime}
                      aria-label={activity.deadline.ariaLabel}
                    >
                      {activity.deadline.display}
                    </time>
                  </div>
                  <p className="activity__detail" id={detailId}>
                    {activity.detail}
                  </p>
                  <p className="activity__status" id={statusId}>
                    <span aria-hidden="true">{activity.status}</span>
                    <span className="visually-hidden">
                      Status for {activity.name}: {activity.status}
                    </span>
                  </p>
                </article>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
