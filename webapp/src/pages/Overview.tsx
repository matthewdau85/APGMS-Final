import '../styles/page.css';
import './Overview.css';

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

export default function OverviewPage() {
  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Portfolio pulse</h1>
        <p className="page__description">
          Monitor capital utilization, track live mandates, and surface emerging risk signals
          across your institutional banking relationships.
        </p>
      </header>

      <section aria-label="Key metrics" className="page__grid overview__metric-grid">
        {metrics.map((metric) => (
          <article className="page-card overview__metric-card" key={metric.title}>
            <header className="page-card__header overview__metric-card-header">
              <h2 className="page-card__title">{metric.title}</h2>
              <span className="overview__metric-change">{metric.change}</span>
            </header>
            <p className="page-card__value">{metric.value}</p>
            <p className="page-card__body">{metric.description}</p>
          </article>
        ))}
      </section>

      <section aria-label="Latest activity" className="page-card overview__activity">
        <header className="overview__activity-header">
          <div>
            <h2 className="overview__activity-title">Workflow alerts</h2>
            <p className="overview__activity-subtitle">
              Curated tasks across deal teams and syndicate partners
            </p>
          </div>
          <span className="overview__activity-pill">Live triage</span>
        </header>
        <ul className="overview__activity-list">
          {activities.map((activity) => (
            <li className="overview__activity-item" key={activity.name}>
              <div>
                <p className="overview__activity-name">{activity.name}</p>
                <p className="overview__activity-detail">{activity.detail}</p>
              </div>
              <span className="overview__activity-status">{activity.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
