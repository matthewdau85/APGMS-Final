import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'warning' | 'success';

type BadgeProps = {
  tone?: BadgeTone;
  variant?: 'pill' | 'label';
  children: ReactNode;
};

function Badge({ tone = 'neutral', variant = 'label', children }: BadgeProps) {
  return <span className={`badge badge--${tone} badge--${variant}`}>{children}</span>;
}

type Kpi = {
  title: string;
  primary: string;
  secondary: string;
  badge?: ReactNode;
  helper?: string;
};

type KpiGroupProps = {
  items: Kpi[];
};

function KpiGroup({ items }: KpiGroupProps) {
  return (
    <div className="kpi-group">
      {items.map((item) => (
        <article key={item.title} className="kpi-card">
          <header className="kpi-card__header">
            <h2>{item.title}</h2>
            {item.badge}
          </header>
          <p className="kpi-card__value">{item.primary}</p>
          <p className="kpi-card__sub">{item.secondary}</p>
          {item.helper ? <p className="kpi-card__helper">{item.helper}</p> : null}
        </article>
      ))}
    </div>
  );
}

type HeatCardTone = 'warning' | 'success';

type HeatCardProps = {
  location: string;
  period: string;
  variance: string;
  confidence: string;
  tone: HeatCardTone;
};

function HeatCard({ location, period, variance, confidence, tone }: HeatCardProps) {
  return (
    <article className={`heat-card heat-card--${tone}`}>
      <header className="heat-card__header">
        <h3>{location}</h3>
        <span className="heat-card__period">{period}</span>
      </header>
      <dl className="heat-card__metrics">
        <div>
          <dt>Variance</dt>
          <dd>{variance}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{confidence}</dd>
        </div>
      </dl>
    </article>
  );
}

const kpis: Kpi[] = [
  {
    title: 'Collected vs Liability',
    primary: '$48,750',
    secondary: 'of $50,000',
    badge: <Badge variant="pill">97.5% funded</Badge>,
    helper: 'Realised GST collections matched against ledger position.'
  },
  {
    title: 'Total Variance',
    primary: '$250',
    secondary: 'Across monitored locations',
    badge: <Badge tone="warning">Review required</Badge>
  },
  {
    title: 'Confidence Score',
    primary: '97%',
    secondary: 'POS and ledger match rate',
    badge: <Badge tone="success">High confidence</Badge>
  }
];

const heatCards: HeatCardProps[] = [
  {
    location: 'Sydney CBD',
    period: 'Week 42',
    variance: '$150',
    confidence: '94%',
    tone: 'warning'
  },
  {
    location: 'Melbourne',
    period: 'Week 42',
    variance: '$80',
    confidence: '98%',
    tone: 'success'
  },
  {
    location: 'Brisbane',
    period: 'Week 42',
    variance: '$20',
    confidence: '99%',
    tone: 'success'
  }
];

const transactions = [
  {
    location: 'Sydney CBD',
    period: 'Week 42',
    collected: '$31,200',
    liability: '$31,350',
    variance: '$150',
    confidence: '94%'
  },
  {
    location: 'Melbourne',
    period: 'Week 42',
    collected: '$10,500',
    liability: '$10,580',
    variance: '$80',
    confidence: '98%'
  },
  {
    location: 'Brisbane',
    period: 'Week 42',
    collected: '$7,050',
    liability: '$7,070',
    variance: '$20',
    confidence: '99%'
  }
];

export default function GstPage() {
  return (
    <div className="gst-page">
      <header className="gst-page__header">
        <h1>GST Reconciliation</h1>
        <p>Validate GST from POS and ledger, resolve variances.</p>
      </header>

      <section aria-label="Key performance indicators" className="gst-page__section">
        <KpiGroup items={kpis} />
      </section>

      <section aria-label="Variance heatmap by location" className="gst-page__section">
        <div className="section-heading">
          <h2>Variance Heatmap by Location</h2>
        </div>
        <div className="heat-grid">
          {heatCards.map((card) => (
            <HeatCard key={card.location} {...card} />
          ))}
        </div>
      </section>

      <section aria-label="Transaction details" className="gst-page__section">
        <div className="section-heading">
          <h2>Transaction Details</h2>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th scope="col">Location</th>
                <th scope="col">Period</th>
                <th scope="col">Collected</th>
                <th scope="col">Liability</th>
                <th scope="col">Variance</th>
                <th scope="col">Confidence</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((row) => (
                <tr key={`${row.location}-${row.period}`}>
                  <td>{row.location}</td>
                  <td>{row.period}</td>
                  <td>{row.collected}</td>
                  <td>{row.liability}</td>
                  <td>{row.variance}</td>
                  <td>{row.confidence}</td>
                  <td>
                    <button type="button" className="action-button">
                      Reconcile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <style jsx>{`
        .gst-page {
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
          padding: 2.5rem 2rem 4rem;
          color: var(--color-text, #0f172a);
          background: var(--color-surface, #f8fafc);
          min-height: 100vh;
        }

        .gst-page__header {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .gst-page__header h1 {
          margin: 0;
          font-size: clamp(2rem, 3vw, 2.5rem);
          font-weight: 600;
          color: var(--color-heading, #0f172a);
        }

        .gst-page__header p {
          margin: 0;
          font-size: 1.05rem;
          color: var(--color-text-muted, #475569);
        }

        .gst-page__section {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .section-heading h2 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--color-heading, #0f172a);
        }

        .kpi-group {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1.25rem;
        }

        .kpi-card {
          padding: 1.5rem;
          border-radius: 1rem;
          background: var(--color-card, #ffffff);
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .kpi-card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .kpi-card__header h2 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text, #0f172a);
        }

        .kpi-card__value {
          margin: 0;
          font-size: 2rem;
          font-weight: 700;
          color: var(--color-heading, #0f172a);
        }

        .kpi-card__sub {
          margin: 0;
          font-size: 0.95rem;
          color: var(--color-text-muted, #475569);
        }

        .kpi-card__helper {
          margin: 0;
          font-size: 0.9rem;
          color: var(--color-text-subtle, #64748b);
        }

        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.01em;
        }

        .badge--label {
          border-radius: 999px;
          padding: 0.25rem 0.75rem;
        }

        .badge--pill {
          border-radius: 999px;
          padding: 0.35rem 0.85rem;
          background: rgba(15, 118, 110, 0.1);
          color: #0f766e;
        }

        .badge--neutral {
          background: rgba(15, 23, 42, 0.08);
          color: #0f172a;
        }

        .badge--warning {
          background: rgba(217, 119, 6, 0.15);
          color: #b45309;
        }

        .badge--success {
          background: rgba(22, 163, 74, 0.15);
          color: #15803d;
        }

        .heat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
        }

        .heat-card {
          padding: 1.25rem;
          border-radius: 1rem;
          background: var(--color-card, #ffffff);
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .heat-card__header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 0.5rem;
        }

        .heat-card__header h3 {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 600;
          color: var(--color-heading, #0f172a);
        }

        .heat-card__period {
          font-size: 0.85rem;
          color: var(--color-text-muted, #475569);
        }

        .heat-card__metrics {
          display: flex;
          justify-content: space-between;
          gap: 1.25rem;
        }

        .heat-card__metrics dt {
          font-size: 0.75rem;
          text-transform: uppercase;
          color: var(--color-text-muted, #475569);
          margin-bottom: 0.35rem;
        }

        .heat-card__metrics dd {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--color-heading, #0f172a);
        }

        .heat-card--warning {
          border: 1px solid rgba(217, 119, 6, 0.2);
        }

        .heat-card--success {
          border: 1px solid rgba(22, 163, 74, 0.2);
        }

        .table-wrapper {
          overflow-x: auto;
          border-radius: 1rem;
          background: var(--color-card, #ffffff);
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 640px;
        }

        thead {
          background: rgba(15, 23, 42, 0.04);
        }

        th,
        td {
          padding: 0.9rem 1.2rem;
          text-align: left;
          font-size: 0.95rem;
        }

        th {
          font-weight: 600;
          color: var(--color-text, #0f172a);
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }

        tbody tr:nth-child(even) {
          background: rgba(15, 23, 42, 0.02);
        }

        .action-button {
          border: none;
          background: linear-gradient(135deg, #0f766e, #0ea5e9);
          color: #ffffff;
          padding: 0.45rem 1.1rem;
          border-radius: 999px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 150ms ease, box-shadow 150ms ease;
        }

        .action-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 20px rgba(14, 165, 233, 0.25);
        }

        .action-button:focus-visible {
          outline: 2px solid #0ea5e9;
          outline-offset: 2px;
        }

        @media (max-width: 720px) {
          .gst-page {
            padding: 2rem 1.25rem 3rem;
            gap: 2rem;
          }

          .heat-card__metrics {
            flex-direction: column;
            gap: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
}
