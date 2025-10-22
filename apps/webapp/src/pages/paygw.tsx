import type { ReactNode } from 'react';
import './paygw.css';

const discrepancyRows: Array<{
  batch: string;
  payCycle: string;
  entity: string;
  secured: string;
  liability: string;
  variance: number;
  status: {
    label: string;
    tone: 'pending' | 'monitor' | 'success';
  };
  notes: string;
}> = [
  {
    batch: 'Batch #42',
    payCycle: 'Week ending 21 Oct',
    entity: 'Aurora Retail Group',
    secured: '$186,400',
    liability: '$202,000',
    variance: -15600,
    status: {
      label: 'Exception',
      tone: 'pending'
    },
    notes: 'Escalated to treasury controls'
  },
  {
    batch: 'Batch #41',
    payCycle: 'Week ending 14 Oct',
    entity: 'Metro Health Partners',
    secured: '$198,750',
    liability: '$206,900',
    variance: -8150,
    status: {
      label: 'Variance review',
      tone: 'monitor'
    },
    notes: 'Awaiting supporting journals'
  },
  {
    batch: 'Batch #40',
    payCycle: 'Week ending 7 Oct',
    entity: 'Harbor Logistics Pty',
    secured: '$204,250',
    liability: '$204,250',
    variance: 0,
    status: {
      label: 'Reconciled',
      tone: 'success'
    },
    notes: 'Cleared via overnight adjustment'
  },
  {
    batch: 'Batch #39',
    payCycle: 'Week ending 30 Sep',
    entity: 'Sunrise Manufacturing',
    secured: '$178,640',
    liability: '$189,200',
    variance: -10560,
    status: {
      label: 'Exception',
      tone: 'pending'
    },
    notes: 'Variance outside tolerance band'
  },
  {
    batch: 'Batch #38',
    payCycle: 'Week ending 23 Sep',
    entity: 'Northern Coast Clinics',
    secured: '$193,980',
    liability: '$195,480',
    variance: -1500,
    status: {
      label: 'Variance review',
      tone: 'monitor'
    },
    notes: 'Clinic awards uplift pending'
  }
];

export default function PaygwPage() {
  return (
    <div className="paygw-page">
      <header className="paygw-header">
        <div className="paygw-header__text">
          <h1 className="paygw-title">PAYGW Flow Manager</h1>
          <p className="paygw-subtitle">
            Monitor payroll feeds, secured balances, and resolve discrepancies.
          </p>
        </div>
        <div className="paygw-toolbar" role="toolbar" aria-label="Discrepancy controls">
          <ToolbarButton icon={<FilterIcon />} label="Filters" />
          <ToolbarButton icon={<RefreshCcwIcon />} label="Refresh" />
        </div>
      </header>

      <section className="summary-grid" aria-label="Secured liability insights">
        <article className="summary-card">
          <header className="summary-card__header">
            <div>
              <h2 className="summary-card__title">Current secured vs liability</h2>
              <p className="summary-card__meta">Updated 4 minutes ago</p>
            </div>
            <GaugeRing value={92} />
          </header>
          <div className="summary-card__stack">
            <span className="summary-card__value">$186,400</span>
            <span className="summary-card__meta">of $202,000 secured for upcoming remittance</span>
          </div>
        </article>

        <article className="summary-card">
          <header className="summary-card__header">
            <div>
              <h2 className="summary-card__title">Next due</h2>
              <p className="summary-card__meta">Payroll tax submission window</p>
            </div>
          </header>
          <div className="summary-card__stack">
            <span className="summary-card__value">Oct 28, 2025</span>
            <span className="paygw-pill">7 days until BAS lodgment</span>
            <span className="summary-card__meta">
              Confirm lodgment package and reconcile final secured totals before submission.
            </span>
          </div>
        </article>

        <article className="summary-card">
          <header className="summary-card__header">
            <div>
              <h2 className="summary-card__title">Variance</h2>
              <p className="summary-card__meta">Shortfall requiring intervention</p>
            </div>
          </header>
          <div className="summary-card__stack">
            <span className="summary-card__value">$15,600 shortfall</span>
            <VarianceBadge>Action Required 7.7%</VarianceBadge>
            <span className="summary-card__meta">
              Allocate additional secured funds or adjust liability schedule to rebalance.
            </span>
          </div>
        </article>
      </section>

      <section className="discrepancy-section" aria-labelledby="discrepancy-heading">
        <header>
          <div>
            <h2 id="discrepancy-heading" className="discrepancy-title">
              Discrepancy queue
            </h2>
            <p className="discrepancy-subtitle">
              Surface payroll batches with outstanding secured balance mismatches
            </p>
          </div>
        </header>
        <DataTable rows={discrepancyRows} />
      </section>
    </div>
  );
}

function GaugeRing({ value }: { value: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, value));
  const offset = circumference * (1 - progress / 100);

  return (
    <div className="gauge-ring" role="img" aria-label={`Secured coverage ${progress}%`}>
      <svg className="gauge-ring__svg" viewBox="0 0 120 120" aria-hidden="true">
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="var(--color-border)"
          strokeWidth="12"
          fill="none"
          opacity="0.35"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="var(--color-primary)"
          strokeWidth="12"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="gauge-ring__value">{progress}%</span>
    </div>
  );
}

function VarianceBadge({ children }: { children: ReactNode }) {
  return (
    <span className="variance-badge">
      <span className="variance-badge__indicator" aria-hidden="true" />
      {children}
    </span>
  );
}

function ToolbarButton({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <button type="button" className="paygw-toolbar__button">
      {icon}
      <span>{label}</span>
    </button>
  );
}

function DataTable({
  rows
}: {
  rows: Array<{
    batch: string;
    payCycle: string;
    entity: string;
    secured: string;
    liability: string;
    variance: number;
    status: { label: string; tone: 'pending' | 'monitor' | 'success' };
    notes: string;
  }>;
}) {
  return (
    <table className="discrepancy-table">
      <thead>
        <tr>
          <th scope="col">Batch</th>
          <th scope="col">Entity</th>
          <th scope="col">Secured</th>
          <th scope="col">Liability</th>
          <th scope="col">Variance</th>
          <th scope="col">Status</th>
          <th scope="col" className="resolve-cell">
            Resolve
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.batch}>
            <td className="discrepancy-table__batch">{row.batch}</td>
            <td className="discrepancy-table__entity">
              <span>{row.entity}</span>
              <span>{row.payCycle}</span>
              <span>{row.notes}</span>
            </td>
            <td>{row.secured}</td>
            <td>{row.liability}</td>
            <td
              className={`discrepancy-table__variance ${
                row.variance >= 0
                  ? 'discrepancy-table__variance--positive'
                  : 'discrepancy-table__variance--negative'
              }`}
            >
              {row.variance > 0
                ? `+$${row.variance.toLocaleString()}`
                : row.variance === 0
                  ? '+$0'
                  : `-$${Math.abs(row.variance).toLocaleString()}`}
            </td>
            <td>
              <StatusChip tone={row.status.tone}>{row.status.label}</StatusChip>
            </td>
            <td className="resolve-cell">
              <button type="button" className="resolve-button" aria-label={`Resolve ${row.batch}`}>
                Resolve
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatusChip({ tone, children }: { tone: 'pending' | 'monitor' | 'success'; children: ReactNode }) {
  return <span className={`status-chip status-chip--${tone}`}>{children}</span>;
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16" />
      <path d="M6 12h12" />
      <path d="M10 20h4" />
    </svg>
  );
}

function RefreshCcwIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v6h6" />
      <path d="M21 12a9 9 0 0 0-9-9H9" />
      <path d="M21 22v-6h-6" />
      <path d="M3 12a9 9 0 0 0 9 9h3" />
    </svg>
  );
}

