import './ObligationDetail.css';

const complianceChecks = [
  {
    title: 'ASIC annual solvency resolution',
    due: '30 September 2024',
    status: 'Board review scheduled',
  },
  {
    title: 'Modern slavery statement',
    due: '31 December 2024',
    status: 'Drafting with legal',
  },
  {
    title: 'AFS license variation report',
    due: '15 November 2024',
    status: 'Awaiting supporting evidence',
  },
] as const;

const policyTasks = [
  {
    title: 'Update enterprise risk matrix',
    owner: 'Risk & compliance',
    status: 'Due next week',
  },
  {
    title: 'Refresh business continuity test plan',
    owner: 'Operations',
    status: 'Draft ready',
  },
  {
    title: 'Circulate whistleblower training pack',
    owner: 'People & culture',
    status: 'Pending distribution',
  },
] as const;

export default function CompliancePage() {
  return (
    <div className="obligation-page">
      <header className="obligation-page__header">
        <h1>Compliance obligations</h1>
        <p>
          Surface regulatory filings, board approvals, and internal assurance actions needed to stay
          audit-ready.
        </p>
      </header>

      <section aria-labelledby="compliance-register" className="obligation-page__section">
        <div className="obligation-page__section-header">
          <h2 id="compliance-register">Register</h2>
          <p className="obligation-page__section-description">
            Core filings and declarations across financial services and corporate governance.
          </p>
        </div>
        <ul className="obligation-page__list">
          {complianceChecks.map((item) => (
            <li key={item.title} className="obligation-page__item">
              <div>
                <p className="obligation-page__item-title">{item.title}</p>
                <p className="obligation-page__item-meta">Due {item.due}</p>
              </div>
              <span className="obligation-page__item-status">{item.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="compliance-actions" className="obligation-page__section">
        <div className="obligation-page__section-header">
          <h2 id="compliance-actions">Action items</h2>
          <p className="obligation-page__section-description">
            Policy reviews and readiness tasks owned by first-line teams.
          </p>
        </div>
        <ul className="obligation-page__list">
          {policyTasks.map((task) => (
            <li key={task.title} className="obligation-page__item">
              <div>
                <p className="obligation-page__item-title">{task.title}</p>
                <p className="obligation-page__item-meta">Owner: {task.owner}</p>
              </div>
              <span className="obligation-page__item-status">{task.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
