import { useEffect, useState } from 'react';
import './Home.css';
import {
  getAuditTrail,
  getGstVariance,
  getObligations,
  getPaygwQueue,
  isAbortError
} from '../lib/api';
import type {
  AuditTrailItem,
  GstVariance,
  Obligation,
  PaygwQueueItem
} from '../lib/types';

type AsyncState<T> = {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: T;
  error?: string;
};

function createInitialState<T>(data: T): AsyncState<T> {
  return {
    status: 'idle',
    data,
    error: undefined
  };
}

function toStatusClass(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '-');
}

export default function HomePage() {
  const [obligationsState, setObligationsState] = useState<AsyncState<Obligation[]>>(
    createInitialState<Obligation[]>([])
  );
  const [queueState, setQueueState] = useState<AsyncState<PaygwQueueItem[]>>(
    createInitialState<PaygwQueueItem[]>([])
  );
  const [gstState, setGstState] = useState<AsyncState<GstVariance | null>>(
    createInitialState<GstVariance | null>(null)
  );
  const [auditState, setAuditState] = useState<AsyncState<AuditTrailItem[]>>(
    createInitialState<AuditTrailItem[]>([])
  );

  useEffect(() => {
    const controller = new AbortController();
    setObligationsState((prev) => ({ ...prev, status: 'loading', error: undefined }));

    getObligations({ signal: controller.signal })
      .then((data) => {
        setObligationsState({ status: 'success', data, error: undefined });
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return;
        }

        setObligationsState({
          status: 'error',
          data: [],
          error: 'Unable to load upcoming obligations right now.'
        });
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setQueueState((prev) => ({ ...prev, status: 'loading', error: undefined }));

    getPaygwQueue({ signal: controller.signal })
      .then((data) => {
        setQueueState({ status: 'success', data, error: undefined });
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return;
        }

        setQueueState({
          status: 'error',
          data: [],
          error: 'We could not fetch the PAYGW queue. Please try again.'
        });
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setGstState((prev) => ({ ...prev, status: 'loading', error: undefined }));

    getGstVariance({ signal: controller.signal })
      .then((data) => {
        setGstState({ status: 'success', data, error: undefined });
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return;
        }

        setGstState({
          status: 'error',
          data: null,
          error: 'GST variance insights are temporarily unavailable.'
        });
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setAuditState((prev) => ({ ...prev, status: 'loading', error: undefined }));

    getAuditTrail({ signal: controller.signal })
      .then((data) => {
        setAuditState({ status: 'success', data, error: undefined });
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return;
        }

        setAuditState({
          status: 'error',
          data: [],
          error: 'We could not retrieve the audit trail feed.'
        });
      });

    return () => controller.abort();
  }, []);

  const renderObligationCards = () => {
    if (obligationsState.status === 'loading' || obligationsState.status === 'idle') {
      return Array.from({ length: 3 }).map((_, index) => (
        <article key={`obligation-skeleton-${index}`} className="metric-card metric-card--loading" aria-hidden>
          <div className="skeleton skeleton--pill" />
          <div className="skeleton skeleton--heading" />
          <div className="skeleton skeleton--text" />
          <div className="skeleton skeleton--text skeleton--short" />
        </article>
      ));
    }

    if (obligationsState.status === 'error') {
      return (
        <article className="metric-card metric-card--message" role="alert">
          <h2>Unable to load obligations</h2>
          <p>{obligationsState.error}</p>
        </article>
      );
    }

    if (!obligationsState.data.length) {
      return (
        <article className="metric-card metric-card--message">
          <h2>You're all caught up</h2>
          <p>All payroll and tax obligations are reconciled. New items will surface here automatically.</p>
        </article>
      );
    }

    return obligationsState.data.map((obligation) => (
      <article key={obligation.id} className="metric-card">
        <header className="metric-card__header">
          <h2>{obligation.name}</h2>
          <span className={`metric-card__pill metric-card__pill--status-${toStatusClass(obligation.status)}`}>
            {obligation.status}
          </span>
        </header>
        <p className="metric-card__value">{obligation.amount}</p>
        <p className="metric-card__change">{obligation.dueDate}</p>
        <p className="metric-card__description">{obligation.commentary}</p>
      </article>
    ));
  };

  const renderGstVarianceCard = () => {
    if (gstState.status === 'loading' || gstState.status === 'idle') {
      return (
        <article className="metric-card metric-card--loading" aria-hidden>
          <div className="skeleton skeleton--pill" />
          <div className="skeleton skeleton--heading" />
          <div className="skeleton skeleton--text" />
          <div className="skeleton skeleton--text skeleton--short" />
        </article>
      );
    }

    if (gstState.status === 'error') {
      return (
        <article className="metric-card metric-card--message" role="alert">
          <h2>GST variance unavailable</h2>
          <p>{gstState.error}</p>
        </article>
      );
    }

    if (!gstState.data) {
      return (
        <article className="metric-card metric-card--message">
          <h2>No GST variance flagged</h2>
          <p>Variance alerts will appear here once we detect movement outside configured thresholds.</p>
        </article>
      );
    }

    const { variance, direction, entity, narrative, updated } = gstState.data;
    const formattedVariance = `${direction === 'Increase' ? '+' : '−'}${variance.toFixed(1)}%`;

    return (
      <article className="metric-card metric-card--gst">
        <header className="metric-card__header metric-card__header--stacked">
          <div>
            <h2>GST variance</h2>
            <p className="metric-card__entity">{entity}</p>
          </div>
          <span
            className={`metric-card__pill metric-card__pill--variance metric-card__pill--${direction === 'Increase' ? 'increase' : 'decrease'}`}
          >
            {formattedVariance}
          </span>
        </header>
        <p className="metric-card__description">{narrative}</p>
        <p className="metric-card__footnote">{updated}</p>
      </article>
    );
  };

  const renderQueueTableBody = () => {
    if (queueState.status === 'loading' || queueState.status === 'idle') {
      return (
        <tbody>
          {Array.from({ length: 3 }).map((_, index) => (
            <tr key={`queue-skeleton-${index}`}>
              <td colSpan={5}>
                <div className="skeleton skeleton--text" />
              </td>
            </tr>
          ))}
        </tbody>
      );
    }

    if (queueState.status === 'error') {
      return (
        <tbody>
          <tr>
            <td colSpan={5} className="queue__message" role="alert">
              <h3>We couldn't load the PAYGW queue</h3>
              <p>{queueState.error}</p>
            </td>
          </tr>
        </tbody>
      );
    }

    if (!queueState.data.length) {
      return (
        <tbody>
          <tr>
            <td colSpan={5} className="queue__message">
              <h3>No filings waiting</h3>
              <p>Great news—there are no PAYGW submissions pending. New filings will show up here automatically.</p>
            </td>
          </tr>
        </tbody>
      );
    }

    return (
      <tbody>
        {queueState.data.map((item) => (
          <tr key={item.id}>
            <th scope="row">{item.employer}</th>
            <td>{item.amount}</td>
            <td>{item.payPeriod}</td>
            <td>
              <span className={`queue__status queue__status--${toStatusClass(item.status)}`}>
                {item.status}
              </span>
            </td>
            <td>{item.nextAction}</td>
          </tr>
        ))}
      </tbody>
    );
  };

  const renderAuditTrail = () => {
    if (auditState.status === 'loading' || auditState.status === 'idle') {
      return (
        <ul className="activity__list">
          {Array.from({ length: 3 }).map((_, index) => (
            <li key={`audit-skeleton-${index}`} className="activity__item activity__item--loading" aria-hidden>
              <div className="activity__skeleton">
                <div className="skeleton skeleton--text" />
                <div className="skeleton skeleton--text skeleton--short" />
              </div>
            </li>
          ))}
        </ul>
      );
    }

    if (auditState.status === 'error') {
      return (
        <div className="activity__message" role="alert">
          <h3>Unable to load audit trail</h3>
          <p>{auditState.error}</p>
        </div>
      );
    }

    if (!auditState.data.length) {
      return (
        <div className="activity__message">
          <h3>No activity yet</h3>
          <p>When your team lodges payroll or GST updates, we'll capture the approvals and submissions right here.</p>
        </div>
      );
    }

    return (
      <ul className="activity__list">
        {auditState.data.map((item) => (
          <li key={item.id} className="activity__item">
            <div>
              <p className="activity__name">{item.action}</p>
              <p className="activity__detail">{item.context}</p>
            </div>
            <div className="activity__meta">
              <span className="activity__actor">{item.actor}</span>
              <span className="activity__timestamp">{item.timestamp}</span>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="page">
      <header className="page__header">
        <h1>Portfolio pulse</h1>
        <p>
          Monitor capital utilization, track live mandates, and surface emerging risk signals across your institutional
          banking relationships.
        </p>
      </header>

      <section aria-label="Compliance summary" className="metric-grid">
        {renderObligationCards()}
        {renderGstVarianceCard()}
      </section>

      <section aria-label="PAYGW filing queue" className="queue">
        <div className="queue__header">
          <h2>PAYGW filing queue</h2>
          <p className="queue__subtitle">Stay ahead of payroll withholding deadlines across every operating entity.</p>
        </div>
        <div className="queue__table-wrapper">
          <table>
            <caption className="sr-only">Upcoming PAYGW filings and their current status</caption>
            <thead>
              <tr>
                <th scope="col">Employer</th>
                <th scope="col">Amount</th>
                <th scope="col">Pay period</th>
                <th scope="col">Status</th>
                <th scope="col">Next step</th>
              </tr>
            </thead>
            {renderQueueTableBody()}
          </table>
        </div>
      </section>

      <section aria-label="Audit trail" className="activity">
        <div className="activity__header">
          <h2>Audit trail</h2>
          <p className="activity__subtitle">Latest submissions and approvals across your compliance workflows.</p>
        </div>
        {renderAuditTrail()}
      </section>
    </div>
  );
}
