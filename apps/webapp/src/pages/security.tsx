import { useMemo, useState } from 'react';

type IntegrationState = 'Secure' | 'Monitor';

type IntegrationConfig = {
  id: string;
  name: string;
  status: IntegrationState;
  lastSync: string;
};

type AnomalySeverity = 'Low' | 'Medium' | 'High';

type AnomalyFeedRow = {
  id: string;
  timestamp: string;
  source: string;
  rule: string;
  severity: AnomalySeverity;
  description: string;
};

const integrations: IntegrationConfig[] = [
  {
    id: 'core-banking',
    name: 'Core Banking API',
    status: 'Secure',
    lastSync: '2m ago'
  },
  {
    id: 'payments-gateway',
    name: 'Payments Gateway',
    status: 'Monitor',
    lastSync: '5m ago'
  },
  {
    id: 'aml-engine',
    name: 'AML Intelligence',
    status: 'Secure',
    lastSync: '1m ago'
  },
  {
    id: 'customer-identity',
    name: 'Customer Identity Graph',
    status: 'Monitor',
    lastSync: '12m ago'
  }
];

const anomalyFeed: AnomalyFeedRow[] = [
  {
    id: 'banking-api-outlier',
    timestamp: '2024-08-12 09:24:33',
    source: 'Banking API',
    rule: 'Large Transaction Outlier',
    severity: 'Low',
    description: '$82,400 transfer cleared but flagged for post-trade review'
  },
  {
    id: 'pos-spike',
    timestamp: '2024-08-12 08:57:18',
    source: 'Retail POS Network',
    rule: 'Velocity Spike',
    severity: 'Medium',
    description: 'Regional card-present activity exceeded hourly baseline thresholds'
  }
];

const statePalette: Record<IntegrationState, { background: string; text: string }> = {
  Secure: {
    background: 'rgba(10, 125, 87, 0.15)',
    text: 'var(--color-success)'
  },
  Monitor: {
    background: 'rgba(27, 87, 184, 0.15)',
    text: '#1b57b8'
  }
};

const severityPalette: Record<AnomalySeverity, { background: string; text: string }> = {
  Low: {
    background: 'rgba(10, 125, 87, 0.12)',
    text: 'var(--color-success)'
  },
  Medium: {
    background: 'rgba(185, 115, 24, 0.15)',
    text: 'var(--color-warning)'
  },
  High: {
    background: 'rgba(196, 71, 71, 0.12)',
    text: 'var(--color-danger)'
  }
};

function IntegrationTile({ integration }: { integration: IntegrationConfig }) {
  const palette = statePalette[integration.status];

  return (
    <article
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '1.25rem',
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{integration.name}</h3>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            backgroundColor: palette.background,
            color: palette.text,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          {integration.status}
        </span>
      </header>
      <ul
        style={{
          listStyle: 'none',
          display: 'grid',
          gap: '0.35rem',
          padding: 0,
          margin: 0,
          fontSize: '0.875rem',
          color: 'var(--color-text-muted)'
        }}
      >
        <li style={{ color: 'var(--color-text)' }}>MFA Enabled</li>
        <li>AES-256 Encrypted</li>
        <li style={{ color: 'var(--color-text)' }}>Last sync: {integration.lastSync}</li>
      </ul>
    </article>
  );
}

function SeverityChip({ severity }: { severity: AnomalySeverity }) {
  const palette = severityPalette[severity];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.2rem 0.6rem',
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        backgroundColor: palette.background,
        color: palette.text,
        textTransform: 'uppercase',
        letterSpacing: '0.03em'
      }}
    >
      {severity}
    </span>
  );
}

function DataTable({ rows }: { rows: AnomalyFeedRow[] }) {
  return (
    <div style={{ overflowX: 'auto', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <th style={{ padding: '0.75rem 1.25rem' }}>Timestamp</th>
            <th style={{ padding: '0.75rem 1.25rem' }}>Source</th>
            <th style={{ padding: '0.75rem 1.25rem' }}>Rule Triggered</th>
            <th style={{ padding: '0.75rem 1.25rem' }}>Severity</th>
            <th style={{ padding: '0.75rem 1.25rem' }}>Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} style={{ borderTop: '1px solid var(--color-border)' }}>
              <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.9rem', fontWeight: 500 }}>{row.timestamp}</td>
              <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.9rem' }}>{row.source}</td>
              <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.9rem' }}>{row.rule}</td>
              <td style={{ padding: '0.85rem 1.25rem' }}>
                <SeverityChip severity={row.severity} />
              </td>
              <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type SliderRowProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  helper?: string;
  formatValue?: (value: number) => string;
};

function SliderRow({
  label,
  value,
  onChange,
  min,
  max,
  step,
  helper,
  formatValue
}: SliderRowProps) {
  const display = useMemo(() => (formatValue ? formatValue(value) : value.toString()), [formatValue, value]);

  return (
    <div
      style={{
        display: 'grid',
        gap: '0.5rem',
        padding: '1.25rem',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{label}</h3>
          {helper ? (
            <p style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{helper}</p>
          ) : null}
        </div>
        <span style={{ fontWeight: 600 }}>{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  );
}

type SwitchRowProps = {
  label: string;
  helper?: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
};

function SwitchRow({ label, helper, enabled, onChange }: SwitchRowProps) {
  return (
    <label
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.25rem',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        gap: '1rem'
      }}
    >
      <span>
        <span style={{ display: 'block', fontWeight: 600 }}>{label}</span>
        {helper ? <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{helper}</span> : null}
      </span>
      <span
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          width: '3rem',
          height: '1.6rem'
        }}
      >
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onChange(event.target.checked)}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            opacity: 0,
            margin: 0,
            cursor: 'pointer'
          }}
        />
        <span
          aria-hidden
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '999px',
            backgroundColor: enabled ? 'var(--color-primary)' : 'var(--color-border-strong)',
            transition: 'background-color 0.2s ease'
          }}
        />
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            left: enabled ? '1.5rem' : '0.3rem',
            transform: 'translateY(-50%)',
            width: '1.1rem',
            height: '1.1rem',
            borderRadius: '50%',
            backgroundColor: 'var(--color-surface)',
            boxShadow: '0 2px 6px rgba(15, 23, 42, 0.25)',
            transition: 'left 0.2s ease'
          }}
        />
      </span>
    </label>
  );
}

export default function SecurityPage() {
  const [transactionThreshold, setTransactionThreshold] = useState(75000);
  const [patternSensitivity, setPatternSensitivity] = useState(70);
  const [failedAttempts, setFailedAttempts] = useState(5);
  const [realTimeMonitoring, setRealTimeMonitoring] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [autoBlockHighRisk, setAutoBlockHighRisk] = useState(false);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

  const formatPercentage = (value: number) => `${value}%`;

  return (
    <div
      style={{
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        background: 'var(--color-background)',
        minHeight: '100vh'
      }}
    >
      <header style={{ display: 'grid', gap: '0.5rem' }}>
        <h1 style={{ fontSize: '1.75rem' }}>Security command center</h1>
        <p style={{ color: 'var(--color-text-muted)', maxWidth: '60ch' }}>
          Monitor platform hardening across your financial services infrastructure with consolidated anomaly
          insights and adaptive thresholds tuned for regulated environments.
        </p>
      </header>

      <section style={{ display: 'grid', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ fontSize: '1.2rem' }}>System Connections</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Live integrations overview</span>
        </div>
        <div
          style={{
            display: 'grid',
            gap: '1.25rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))'
          }}
        >
          {integrations.map((integration) => (
            <IntegrationTile key={integration.id} integration={integration} />
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ fontSize: '1.2rem' }}>Anomaly Detection Feed</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Streaming risk intelligence</span>
        </div>
        <DataTable rows={anomalyFeed} />
      </section>

      <section style={{ display: 'grid', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ fontSize: '1.2rem' }}>Security Thresholds</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Adaptive guardrails</span>
        </div>
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          <SliderRow
            label="Large Transaction Threshold"
            value={transactionThreshold}
            onChange={setTransactionThreshold}
            min={10000}
            max={200000}
            step={5000}
            formatValue={formatCurrency}
          />
          <SliderRow
            label="Unusual Pattern Detection Sensitivity"
            value={patternSensitivity}
            onChange={setPatternSensitivity}
            min={10}
            max={100}
            step={5}
            helper="Higher sensitivity detects more anomalies but may increase noise."
            formatValue={formatPercentage}
          />
          <SliderRow
            label="Failed Access Attempts Before Lock"
            value={failedAttempts}
            onChange={setFailedAttempts}
            min={1}
            max={10}
            step={1}
          />
        </div>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <SwitchRow label="Real-time Monitoring" enabled={realTimeMonitoring} onChange={setRealTimeMonitoring} />
          <SwitchRow label="Email Alerts" enabled={emailAlerts} onChange={setEmailAlerts} />
          <SwitchRow
            label="Automatic Block High-Risk Transactions"
            enabled={autoBlockHighRisk}
            onChange={setAutoBlockHighRisk}
          />
        </div>
        <button
          type="button"
          style={{
            marginTop: '0.5rem',
            alignSelf: 'flex-start',
            padding: '0.85rem 1.75rem',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            fontWeight: 600,
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-primary-contrast)',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          Save Threshold Settings
        </button>
      </section>
    </div>
  );
}
