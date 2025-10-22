import { useEffect, useState } from 'react';
import './BankLines.css';
import { getConnections, isAbortError } from '../lib/api';
import type { Connection, ConnectionStatus } from '../lib/types';

type AsyncState<T> = {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: T;
  error?: string;
};

const statusLabels: Record<ConnectionStatus, string> = {
  Active: 'Operational',
  Pending: 'Requires approval',
  Monitoring: 'Watch closely'
};

export default function BankLinesPage() {
  const [connectionsState, setConnectionsState] = useState<AsyncState<Connection[]>>({
    status: 'idle',
    data: [],
    error: undefined
  });

  useEffect(() => {
    const controller = new AbortController();
    setConnectionsState((prev) => ({ ...prev, status: 'loading', error: undefined }));

    getConnections({ signal: controller.signal })
      .then((data) => {
        setConnectionsState({ status: 'success', data, error: undefined });
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return;
        }

        setConnectionsState({
          status: 'error',
          data: [],
          error: 'We were unable to load your bank line data.'
        });
      });

    return () => controller.abort();
  }, []);

  const renderTableBody = () => {
    if (connectionsState.status === 'loading' || connectionsState.status === 'idle') {
      return (
        <tbody>
          {Array.from({ length: 3 }).map((_, index) => (
            <tr key={`connection-skeleton-${index}`}>
              <td colSpan={6}>
                <div className="skeleton skeleton--text" />
              </td>
            </tr>
          ))}
        </tbody>
      );
    }

    if (connectionsState.status === 'error') {
      return (
        <tbody>
          <tr>
            <td colSpan={6} className="bank-lines__message" role="alert">
              <h2>Unable to load bank line visibility</h2>
              <p>{connectionsState.error}</p>
            </td>
          </tr>
        </tbody>
      );
    }

    if (!connectionsState.data.length) {
      return (
        <tbody>
          <tr>
            <td colSpan={6} className="bank-lines__message">
              <h2>No bank lines connected yet</h2>
              <p>
                Connect a treasury data source to surface utilization, covenants, and watchlist signals for your
                institutional lenders.
              </p>
            </td>
          </tr>
        </tbody>
      );
    }

    return (
      <tbody>
        {connectionsState.data.map((line) => (
          <tr key={line.id}>
            <th scope="row">{line.bank}</th>
            <td>{line.limit}</td>
            <td>
              <div className="bank-lines__utilization">
                <span>{line.utilization}</span>
                <div className="bank-lines__utilization-track" aria-hidden="true">
                  <div className="bank-lines__utilization-fill" style={{ width: line.utilization }} />
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
    );
  };

  return (
    <div className="bank-lines">
      <header className="bank-lines__header">
        <div>
          <h1>Bank line visibility</h1>
          <p>
            Stay ahead of liquidity requirements with a consolidated view of commitments, live utilization, and watchlist
            signals across your institutional lenders.
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
          {renderTableBody()}
        </table>
      </div>
    </div>
  );
}
