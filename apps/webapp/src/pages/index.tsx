import { AppShell } from '../components/AppShell';
import styles from './index.module.css';

type TrendCard = {
  id: string;
  label: string;
  metric: string;
  caption: string;
  stroke: string;
};

type Integration = {
  label: string;
  value: string;
  status: string;
  emphasis?: boolean;
};

const trendCards: TrendCard[] = [
  {
    id: 'paygw',
    label: 'PAYGW 7-Day Trend',
    metric: '92.3%',
    caption: 'secured at 92.3% of liability',
    stroke: '#2563eb',
  },
  {
    id: 'gst',
    label: 'GST 7-Day Trend',
    metric: '97.5%',
    caption: 'secured at 97.5% of liability',
    stroke: '#0ea5e9',
  },
];

const integrations: Integration[] = [
  { label: 'Payroll System', value: 'Xero Payroll', status: 'Connected' },
  { label: 'Banking', value: 'CBA API', status: 'Synced' },
  { label: 'POS', value: 'Square POS', status: 'Monitor', emphasis: true },
  { label: 'ATO', value: 'STP', status: 'Connected' },
];

function VarianceBadge() {
  return <span className={styles.badge}>Shortfall — Requires attention</span>;
}

function ReviewBadge() {
  return <span className={`${styles.badge} ${styles['badge--review']}`}>Review — Needs improvement</span>;
}

function MiniTrend({ id, stroke }: { id: string; stroke: string }) {
  return (
    <svg className={styles.trendSparkline} viewBox="0 0 120 40" role="img" aria-labelledby={`${id}-title`}>
      <title id={`${id}-title`}>7 day trend sparkline</title>
      <defs>
        <linearGradient id={`${id}-gradient`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 28 C 20 8, 40 34, 60 18 C 80 6, 100 30, 120 16"
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
        opacity={0.9}
      />
      <path
        d="M0 28 C 20 8, 40 34, 60 18 C 80 6, 100 30, 120 16 L 120 40 L 0 40 Z"
        fill={`url(#${id}-gradient)`}
        opacity={0.6}
      />
    </svg>
  );
}

function IntegrationTile({ label, value, status, emphasis }: Integration) {
  return (
    <article className={styles.integrationTile}>
      <p className={styles.integrationLabel}>{label}</p>
      <p className={styles.integrationValue}>{value}</p>
      <p
        className={`${styles.integrationStatus} ${
          emphasis ? styles.integrationStatusMonitor : ''
        }`}
      >
        {status}
      </p>
    </article>
  );
}

export default function OverviewPage() {
  return (
    <AppShell title="Business Overview" description="Real-time visibility into cash exposure, compliance, and integration health across your portfolio.">
      <div className={styles.page}>
        <section className={styles.metricGrid} aria-label="Key metrics">
          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Variance Delta</h2>
              <VarianceBadge />
            </div>
            <p className={styles.amount}>$16,850</p>
            <p className={styles.subtle}>Net variance across monitored liabilities.</p>
          </article>

          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Overall Compliance</h2>
              <ReviewBadge />
            </div>
            <p className={styles.amount}>94.9%</p>
            <p className={styles.subtle}>Compliance health benchmarked against regulatory obligations.</p>
          </article>

          {trendCards.map((card) => (
            <article key={card.id} className={`${styles.card} ${styles.trendCard}`}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>{card.label}</h2>
              </div>
              <p className={styles.trendMetric}>{card.metric}</p>
              <MiniTrend id={card.id} stroke={card.stroke} />
              <p className={styles.trendCaption}>{card.caption}</p>
            </article>
          ))}
        </section>

        <section className={styles.integrationSection} aria-label="Integration health">
          <div className={styles.integrationHeader}>
            <h2 className={styles.integrationTitle}>Integration Health</h2>
            <p className={styles.integrationSubtitle}>
              Monitoring connected systems to ensure payroll, banking, and compliance data stays in sync.
            </p>
          </div>
          <div className={styles.integrationGrid}>
            {integrations.map((integration) => (
              <IntegrationTile key={integration.label} {...integration} />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
