import './BankLines.css';
import { IconButton } from '../components/IconButton';

type LineStatus = 'Active' | 'Pending' | 'Monitoring';

type BankLine = {
  bank: string;
  limit: string;
  utilization: string;
  status: LineStatus;
  updated: string;
  notes: string;
};

const bankLines: BankLine[] = [
  {
    bank: 'Commonwealth Bank',
    limit: '$1.2B',
    utilization: '64%',
    status: 'Active',
    updated: 'Today 10:24',
    notes: 'Term sheet expansion approved for Helios storage facility.'
  },
  {
    bank: 'Northwind Credit Union',
    limit: '$820M',
    utilization: '71%',
    status: 'Monitoring',
    updated: 'Yesterday',
    notes: 'Utilization trending upward ahead of portfolio rebalance.'
  },
  {
    bank: 'First Harbor Partners',
    limit: '$640M',
    utilization: '48%',
    status: 'Pending',
    updated: '2 days ago',
    notes: 'Awaiting revised covenants from legal after counterparty feedback.'
  }
];

const statusLabels: Record<LineStatus, string> = {
  Active: 'Operational',
  Pending: 'Requires approval',
  Monitoring: 'Watch closely'
};

export default function BankLinesPage() {
  return (
    <div className="bank-lines">
      <header className="bank-lines__header">
        <div>
          <h1>Bank line visibility</h1>
          <p>
            Stay ahead of liquidity requirements with a consolidated view of commitments, live utilization,
            and watchlist signals across your institutional lenders.
          </p>
        </div>
        <div className="bank-lines__actions" role="toolbar" aria-label="Table actions">
          <IconButton label="Filters" className="bank-lines__icon-button">
            <svg aria-hidden="true" viewBox="0 0 20 20">
              <path
                d="M3.5 5A1.5 1.5 0 0 1 5 3.5h10A1.5 1.5 0 0 1 16.5 5c0 .4-.16.78-.44 1.06l-3.56 3.56v4.13c0 .29-.12.56-.32.75l-2 2a1.06 1.06 0 0 1-1.81-.75v-6.13L3.94 6.06A1.5 1.5 0 0 1 3.5 5Z"
                fill="currentColor"
              />
            </svg>
          </IconButton>
          <IconButton label="Refresh" className="bank-lines__icon-button">
            <svg aria-hidden="true" viewBox="0 0 20 20">
              <path
                d="M15.78 5.72a.75.75 0 0 1 1.32.51v4.02a.75.75 0 0 1-.75.75H12.3a.75.75 0 0 1-.53-1.28l1.17-1.18A4.24 4.24 0 0 0 4.77 8.6a4.25 4.25 0 0 0 7.62 2.95.75.75 0 0 1 1.1 1.02A5.75 5.75 0 1 1 16 6.64V6a.75.75 0 0 1-.22-.28Z"
                fill="currentColor"
              />
            </svg>
          </IconButton>
          <IconButton label="Export data" className="bank-lines__icon-button">
            <svg aria-hidden="true" viewBox="0 0 20 20">
              <path
                d="M10.75 2.75a.75.75 0 0 0-1.5 0v7.44L7.28 8.22a.75.75 0 1 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 0 0-1.06-1.06l-1.97 1.97Zm-5.5 9.5a.75.75 0 0 0-1.5 0v1.5a2.75 2.75 0 0 0 2.75 2.75h8.5A2.75 2.75 0 0 0 17.25 13.75v-1.5a.75.75 0 0 0-1.5 0v1.5c0 .69-.56 1.25-1.25 1.25h-8.5a1.25 1.25 0 0 1-1.25-1.25Z"
                fill="currentColor"
              />
            </svg>
          </IconButton>
          <button type="button" className="bank-lines__cta">
            Export exposure report
          </button>
        </div>
      </header>

      <div className="bank-lines__table-wrapper">
        <table>
          <caption className="sr-only">Breakdown of bank line utilization and statuses</caption>
          <thead>
            <tr>
              <th scope="col">Lender</th>
              <th scope="col" className="numeric">
                Limit
              </th>
              <th scope="col" className="numeric">
                Utilization
              </th>
              <th scope="col">Status</th>
              <th scope="col">Updated</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {bankLines.map((line) => (
              <tr key={line.bank}>
                <th scope="row">{line.bank}</th>
                <td className="numeric">{line.limit}</td>
                <td className="numeric">
                  <div className="bank-lines__utilization">
                    <span>{line.utilization}</span>
                    <div className="bank-lines__utilization-track" aria-hidden="true">
                      <div
                        className="bank-lines__utilization-fill"
                        style={{ width: line.utilization }}
                      />
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`status-badge status-badge--${line.status.toLowerCase()}`}>
                    <span className="status-badge__label">{line.status}</span>
                    <span className="status-badge__hint">{statusLabels[line.status]}</span>
                  </span>
                </td>
                <td>{line.updated}</td>
                <td>{line.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
