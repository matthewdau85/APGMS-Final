import { useMemo, useState } from 'react';
import AuditTrail from '../components/AuditTrail';
import '../styles/compliance.css';

type AlertStatus = 'Open' | 'Investigating' | 'Resolved';

type Alert = {
  id: number;
  title: string;
  description: string;
  status: AlertStatus;
  timestamp: string;
};

type PenaltyStatus = 'Open' | 'Approved' | 'Declined';

type PenaltyNotice = {
  id: number;
  reference: string;
  entity: string;
  amount: string;
  status: PenaltyStatus;
  submittedOn: string;
};

const alerts: Alert[] = [
  {
    id: 1,
    title: 'Variance spotted on PAYGW statement',
    description: 'Syndicate partner flagged additional withholding credits requiring support.',
    status: 'Open',
    timestamp: '2024-06-11T08:30:00+10:00'
  },
  {
    id: 2,
    title: 'Missing remissions memo for Helios facility',
    description: 'Upload the signed Commonwealth Bank remission letter to close out review.',
    status: 'Investigating',
    timestamp: '2024-06-10T17:10:00+10:00'
  },
  {
    id: 3,
    title: 'Security deed update acknowledged',
    description: 'Collateral register entries reconciled against new mezzanine charge.',
    status: 'Resolved',
    timestamp: '2024-06-09T14:45:00+10:00'
  }
];

const penaltyNotices: PenaltyNotice[] = [
  {
    id: 1,
    reference: 'PN-2141',
    entity: 'NovaWind Holdings',
    amount: '$12,400',
    status: 'Open',
    submittedOn: '2024-05-28T00:00:00+10:00'
  },
  {
    id: 2,
    reference: 'RM-1088',
    entity: 'Helios Storage Trust',
    amount: '$8,950',
    status: 'Approved',
    submittedOn: '2024-05-22T00:00:00+10:00'
  },
  {
    id: 3,
    reference: 'PN-2086',
    entity: 'Urban Mobility Fund II',
    amount: '$5,675',
    status: 'Declined',
    submittedOn: '2024-05-18T00:00:00+10:00'
  },
  {
    id: 4,
    reference: 'RM-1075',
    entity: 'Commonwealth Green Leasing',
    amount: '$15,200',
    status: 'Approved',
    submittedOn: '2024-05-12T00:00:00+10:00'
  }
];

const statusFilters: { label: string; value: PenaltyStatus }[] = [
  { label: 'Open', value: 'Open' },
  { label: 'Approved', value: 'Approved' },
  { label: 'Declined', value: 'Declined' }
];

const statusClass: Record<string, string> = {
  Open: 'status-badge--open',
  Approved: 'status-badge--approved',
  Declined: 'status-badge--declined',
  Investigating: 'status-badge--investigating',
  Resolved: 'status-badge--resolved'
};

function formatDateTime(isoDate: string) {
  return new Date(isoDate).toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function createStatusClass(status: string) {
  return statusClass[status] ?? '';
}

export default function CompliancePage() {
  const [activeStatuses, setActiveStatuses] = useState<PenaltyStatus[]>(() =>
    statusFilters.map((status) => status.value)
  );

  const toggleStatus = (value: PenaltyStatus) => {
    setActiveStatuses((prev) =>
      prev.includes(value)
        ? prev.filter((status) => status !== value)
        : [...prev, value]
    );
  };

  const filteredNotices = useMemo(
    () => penaltyNotices.filter((notice) => activeStatuses.includes(notice.status)),
    [activeStatuses]
  );

  const handleExport = (format: 'csv' | 'pdf') => {
    if (typeof window === 'undefined') {
      return;
    }

    if (format === 'csv') {
      const rows = [
        ['Reference', 'Entity', 'Status', 'Amount', 'Submitted On'],
        ...penaltyNotices.map((notice) => [
          notice.reference,
          notice.entity,
          notice.status,
          notice.amount,
          formatDate(notice.submittedOn)
        ])
      ];

      const csvContent = rows
        .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'compliance-reports.csv';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      console.info('Compliance PDF export requested');
    }
  };

  return (
    <div className="compliance-page">
      <div className="compliance-page__intro">
        <h1>Compliance &amp; remissions</h1>
        <p>
          Keep pre-lodgment alerts, penalty notices, and remission audit trails aligned across the
          treasury team.
        </p>
      </div>

      <section className="compliance-card" aria-labelledby="pre-lodgment-heading">
        <header className="compliance-card__header">
          <div>
            <h2 id="pre-lodgment-heading" className="compliance-card__title">
              Pre-lodgment alerts
            </h2>
            <p className="compliance-card__subtitle">
              Prioritise outstanding data requests and evidence before revenue authority lodgment.
            </p>
          </div>
        </header>
        <ul className="alert-list" aria-label="Pre-lodgment alerts">
          {alerts.map((alert) => (
            <li key={alert.id} className="alert-item">
              <div className="alert-item__info">
                <p className="alert-item__title">{alert.title}</p>
                <p className="alert-item__meta">{alert.description}</p>
                <time className="alert-item__meta" dateTime={alert.timestamp}>
                  {formatDateTime(alert.timestamp)}
                </time>
              </div>
              <span className={`status-badge ${createStatusClass(alert.status)}`}>{alert.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="compliance-card" aria-labelledby="penalty-notices-heading">
        <header className="compliance-card__header">
          <div>
            <h2 id="penalty-notices-heading" className="compliance-card__title">
              Penalty notices &amp; remissions
            </h2>
            <p className="compliance-card__subtitle">
              Track the lifecycle of lodged notices and remission approvals from each authority.
            </p>
          </div>
          <div className="chip-group" role="group" aria-label="Filter penalty notices by status">
            {statusFilters.map((status) => {
              const isActive = activeStatuses.includes(status.value);
              return (
                <button
                  key={status.value}
                  type="button"
                  className={`chip ${isActive ? 'chip--active' : ''}`}
                  aria-pressed={isActive}
                  onClick={() => toggleStatus(status.value)}
                >
                  {status.label}
                </button>
              );
            })}
          </div>
        </header>
        <div className="table-container">
          <table className="data-table" aria-describedby="penalty-notices-heading">
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Entity</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
                <th scope="col">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="audit-trail__empty">
                    No penalty notices match the selected statuses.
                  </td>
                </tr>
              ) : (
                filteredNotices.map((notice) => (
                  <tr key={notice.id}>
                    <td>{notice.reference}</td>
                    <td>{notice.entity}</td>
                    <td className="penalties-amount">{notice.amount}</td>
                    <td>
                      <span className={`status-badge ${createStatusClass(notice.status)}`}>
                        {notice.status}
                      </span>
                    </td>
                    <td>
                      <time dateTime={notice.submittedOn}>{formatDate(notice.submittedOn)}</time>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="compliance-card" aria-labelledby="reports-heading">
        <header className="compliance-card__header">
          <div>
            <h2 id="reports-heading" className="compliance-card__title">
              Reports &amp; exports
            </h2>
            <p className="compliance-card__subtitle">
              Export summaries for treasury committees or attach remissions evidence to your audit
              pack in seconds.
            </p>
          </div>
          <div className="reports-actions">
            <button
              type="button"
              className="report-button"
              aria-label="Export compliance report as CSV"
              onClick={() => handleExport('csv')}
            >
              Export CSV
            </button>
            <button
              type="button"
              className="report-button report-button--secondary"
              aria-label="Export compliance report as PDF"
              onClick={() => handleExport('pdf')}
            >
              Export PDF
            </button>
          </div>
        </header>
      </section>

      <AuditTrail />
    </div>
  );
}
