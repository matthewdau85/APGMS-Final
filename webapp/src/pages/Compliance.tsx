import { useState } from 'react';
import './Compliance.css';

type TabKey = 'Alerts' | 'Payment Plans' | 'Audit Trail' | 'Documents';

type AlertTone = 'warning' | 'info';

type Alert = {
  id: string;
  title: string;
  description: string;
  tone: AlertTone;
  badge: string;
  timestamp: string;
  actionLabel?: string;
};

const alerts: Alert[] = [
  {
    id: 'paygw-variance',
    title: 'PAYGW Variance Detected',
    description: 'Secured funds are 7.7% below liability. Review payroll calculations.',
    tone: 'warning',
    badge: 'Warning',
    timestamp: '2 hours ago',
    actionLabel: 'Investigate →'
  },
  {
    id: 'gst-reconciliation',
    title: 'GST Reconciliation Available',
    description: 'Latest reconciliation package is ready for review.',
    tone: 'info',
    badge: 'Info',
    timestamp: '4 hours ago'
  }
];

const placeholderCopy: Record<Exclude<TabKey, 'Alerts'>, string> = {
  'Payment Plans': 'No payment plan exceptions detected. Upcoming schedules will surface here.',
  'Audit Trail': 'Audit logs will populate with reviewer notes and approval checkpoints.',
  Documents: 'Centralized policy documents and attestations will be listed here for download.'
};

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('Alerts');

  return (
    <div className="compliance">
      <header className="compliance__header">
        <div className="compliance__intro">
          <h1>Compliance control center</h1>
          <p>Monitor alerts, payment plans, audit trail, and compliance documentation.</p>
        </div>
        <button type="button" className="compliance__export">
          Export Reports
        </button>
      </header>

      <section className="compliance__tabs" aria-labelledby="compliance-tabs-heading">
        <h2 id="compliance-tabs-heading" className="sr-only">
          Compliance workspace navigation
        </h2>
        <div className="compliance__tablist" role="tablist" aria-label="Compliance sections">
          {(['Alerts', 'Payment Plans', 'Audit Trail', 'Documents'] as TabKey[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              className="compliance__tab"
              aria-selected={activeTab === tab}
              aria-controls={`compliance-panel-${tab.toLowerCase().replace(/\s+/g, '-')}`}
              id={`compliance-tab-${tab.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`compliance-panel-${activeTab.toLowerCase().replace(/\s+/g, '-')}`}
          aria-labelledby={`compliance-tab-${activeTab.toLowerCase().replace(/\s+/g, '-')}`}
          className="compliance__panel"
        >
          {activeTab === 'Alerts' ? (
            <div className="alert-grid">
              {alerts.map((alert) => (
                <article
                  key={alert.id}
                  className={`alert-card alert-card--${alert.tone}`}
                  aria-label={`${alert.title} alert`}
                >
                  <header className="alert-card__header">
                    <div className="alert-card__content">
                      <h3 className="alert-card__title">{alert.title}</h3>
                      <p className="alert-card__description">{alert.description}</p>
                    </div>
                    <span className="alert-card__pill">{alert.badge}</span>
                  </header>
                  <footer className="alert-card__footer">
                    <span className="alert-card__timestamp">{alert.timestamp}</span>
                    {alert.actionLabel ? (
                      <button type="button" className="alert-card__action">
                        {alert.actionLabel}
                      </button>
                    ) : null}
                  </footer>
                </article>
              ))}
            </div>
          ) : (
            <p className="compliance__placeholder">{placeholderCopy[activeTab]}</p>
          )}
        </div>
      </section>
    </div>
  );
}
