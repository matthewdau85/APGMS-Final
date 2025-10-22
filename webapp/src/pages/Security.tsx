import { useId, useMemo, useState } from 'react';
import './Security.css';

type Connection = {
  name: string;
  description: string;
  status: 'Operational' | 'Attention needed' | 'Connected';
  tone: 'positive' | 'caution' | 'neutral';
};

type Anomaly = {
  id: number;
  timestamp: string;
  displayTime: string;
  source: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High';
};

const connections: Connection[] = [
  {
    name: 'Payroll API',
    description: 'Real-time payroll ledger synchronisation into treasury controls.',
    status: 'Operational',
    tone: 'positive'
  },
  {
    name: 'Banking',
    description: 'Daily settlement files streamed from primary banking custodians.',
    status: 'Operational',
    tone: 'positive'
  },
  {
    name: 'POS',
    description: 'Omnichannel point-of-sale transaction summaries across regions.',
    status: 'Attention needed',
    tone: 'caution'
  },
  {
    name: 'ATO',
    description: 'ATO portal ingest for GST obligations and lodgement confirmations.',
    status: 'Connected',
    tone: 'neutral'
  }
];

const anomalies: Anomaly[] = [
  {
    id: 1,
    timestamp: '2024-07-22T13:04:00Z',
    displayTime: 'Jul 22, 13:04',
    source: 'Payroll API',
    description: 'Surge in manual payroll overrides above variance tolerance.',
    severity: 'High'
  },
  {
    id: 2,
    timestamp: '2024-07-22T12:51:00Z',
    displayTime: 'Jul 22, 12:51',
    source: 'Banking',
    description: 'Clearing delay detected on Commonwealth Bank overnight batch.',
    severity: 'Medium'
  },
  {
    id: 3,
    timestamp: '2024-07-22T12:37:00Z',
    displayTime: 'Jul 22, 12:37',
    source: 'POS',
    description: 'Higher than expected refunds from APAC omnichannel feeds.',
    severity: 'Low'
  }
];

const severityTone: Record<Anomaly['severity'], 'critical' | 'warning' | 'calm'> = {
  High: 'critical',
  Medium: 'warning',
  Low: 'calm'
};

function StatusBadge({ label, hint, tone }: { label: string; hint: string; tone: Connection['tone'] }) {
  return (
    <span className={`status-badge status-badge--${tone}`}>
      <span className="status-badge__dot" aria-hidden="true" />
      <span className="status-badge__label">{label}</span>
      <span className="status-badge__hint">{hint}</span>
    </span>
  );
}

function SeverityBadge({ label }: { label: Anomaly['severity'] }) {
  const tone = severityTone[label];
  return <span className={`severity-badge severity-badge--${tone}`}>{label}</span>;
}

export default function SecurityPage() {
  const [varianceThreshold, setVarianceThreshold] = useState(12);
  const [paymentLimit, setPaymentLimit] = useState(250000);
  const [alertFrequency, setAlertFrequency] = useState(4);

  const varianceHelpId = useId();
  const paymentHelpId = useId();
  const frequencyHelpId = useId();

  const projectedAlerts = useMemo(() => {
    const varianceFactor = varianceThreshold * 1.4;
    const limitFactor = paymentLimit / 60000;
    const cadenceFactor = 12 - alertFrequency * 1.5;
    return Math.max(1, Math.round(varianceFactor + limitFactor + cadenceFactor));
  }, [varianceThreshold, paymentLimit, alertFrequency]);

  return (
    <div className="security-page">
      <header className="security-page__header">
        <h1>Security &amp; fraud watch</h1>
        <p>
          Keep integration health, anomaly triage, and automated thresholds aligned so your
          capital workflows stay protected without slowing operations.
        </p>
      </header>

      <section aria-label="Connections" className="security-section">
        <div className="security-section__header">
          <h2>Connections</h2>
          <p>Integration status across critical data feeds.</p>
        </div>
        <div className="security-connections">
          {connections.map((connection) => (
            <article className="security-card" key={connection.name}>
              <header className="security-card__header">
                <div className="security-card__summary">
                  <h3>{connection.name}</h3>
                  <p>{connection.description}</p>
                </div>
                <StatusBadge label={connection.status} hint="Synced 5m ago" tone={connection.tone} />
              </header>
            </article>
          ))}
        </div>
      </section>

      <section aria-label="Anomalies" className="security-section">
        <div className="security-section__header">
          <h2>Anomalies</h2>
          <p>Live feed of detection events across integrations.</p>
        </div>
        <ul className="security-anomalies">
          {anomalies.map((anomaly) => (
            <li className="security-anomalies__item" key={anomaly.id}>
              <time dateTime={anomaly.timestamp} className="security-anomalies__time">
                {anomaly.displayTime}
              </time>
              <div className="security-anomalies__detail">
                <p className="security-anomalies__source">{anomaly.source}</p>
                <p className="security-anomalies__description">{anomaly.description}</p>
              </div>
              <SeverityBadge label={anomaly.severity} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Thresholds" className="security-section">
        <div className="security-section__header">
          <h2>Thresholds</h2>
          <p>Adjust automated guardrails for fraud and operational risk alerts.</p>
        </div>
        <form className="security-thresholds">
          <div className="security-thresholds__control">
            <label htmlFor="variance">Cash variance tolerance</label>
            <div className="security-thresholds__input">
              <input
                id="variance"
                type="range"
                min={0}
                max={25}
                value={varianceThreshold}
                onChange={(event) => setVarianceThreshold(Number(event.target.value))}
                aria-describedby={varianceHelpId}
              />
              <span className="security-thresholds__value">{varianceThreshold}%</span>
            </div>
            <p id={varianceHelpId} className="security-thresholds__help">
              Trigger anomaly reviews when variance exceeds the selected percentage window.
            </p>
          </div>

          <div className="security-thresholds__control">
            <label htmlFor="payment-limit">Single payment limit</label>
            <div className="security-thresholds__input">
              <input
                id="payment-limit"
                type="number"
                min={50000}
                step={5000}
                value={paymentLimit}
                onChange={(event) =>
                  setPaymentLimit(event.target.value === '' ? 0 : Number(event.target.value))
                }
                aria-describedby={paymentHelpId}
              />
              <span className="security-thresholds__value">
                ${paymentLimit.toLocaleString()}
              </span>
            </div>
            <p id={paymentHelpId} className="security-thresholds__help">
              Block payments exceeding this ceiling for manual secondary approval.
            </p>
          </div>

          <div className="security-thresholds__control">
            <label htmlFor="alert-frequency">Alert digest cadence</label>
            <div className="security-thresholds__input">
              <input
                id="alert-frequency"
                type="range"
                min={1}
                max={8}
                value={alertFrequency}
                onChange={(event) => setAlertFrequency(Number(event.target.value))}
                aria-describedby={frequencyHelpId}
              />
              <span className="security-thresholds__value">Every {alertFrequency}h</span>
            </div>
            <p id={frequencyHelpId} className="security-thresholds__help">
              Control how frequently consolidated fraud digests are distributed to teams.
            </p>
          </div>
        </form>

        <div className="security-thresholds__preview" aria-live="polite">
          <p>Projected daily review load</p>
          <strong>{projectedAlerts} cases</strong>
        </div>
      </section>
    </div>
  );
}
