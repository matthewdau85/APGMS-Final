import './BankLines.css';

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
            Stay ahead of liquidity requirements with a consolidated view of commitments, live
            utilization, and watchlist signals across your institutional lenders.
          </p>
        </div>
        <button type="button" className="bank-lines__cta">
          Export exposure report
        </button>
      </header>

      <div className="bank-lines__table-wrapper">
        <table>
          <caption className="sr-only">Breakdown of bank line utilization and statuses</caption>
          <thead>
            <tr>
              <th scope="col">Lender</th>
              <th scope="col">Limit</th>
              <th scope="col">Utilization</th>
              <th scope="col">Status</th>
              <th scope="col">Updated</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {bankLines.map((line) => (
              <tr key={line.bank}>
                <th scope="row">{line.bank}</th>
                <td>{line.limit}</td>
                <td>
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
