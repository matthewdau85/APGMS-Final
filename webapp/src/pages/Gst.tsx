import './ObligationDetail.css';

const gstReturns = [
  {
    period: 'Q4 FY24 BAS',
    due: '28 August 2024',
    status: 'Ready for CFO sign-off',
  },
  {
    period: 'Q1 FY25 BAS',
    due: '28 October 2024',
    status: 'Data gathering in progress',
  },
  {
    period: 'Annual GST adjustment',
    due: '15 January 2025',
    status: 'Waiting on asset register',
  },
] as const;

const reconciliationTasks = [
  {
    title: 'Cross-check business activity statement draft',
    owner: 'Finance systems',
    status: 'Due tomorrow',
  },
  {
    title: 'Validate GST-free sales exceptions',
    owner: 'Compliance analytics',
    status: 'In progress',
  },
  {
    title: 'Upload new AP invoice mapping rules',
    owner: 'Accounts payable',
    status: 'Ready to review',
  },
] as const;

export default function GstPage() {
  return (
    <div className="obligation-page">
      <header className="obligation-page__header">
        <h1>GST obligations</h1>
        <p>
          Review BAS cycles, data integrity checks, and outstanding reconciliations for Goods and
          Services Tax reporting.
        </p>
      </header>

      <section aria-labelledby="gst-return-schedule" className="obligation-page__section">
        <div className="obligation-page__section-header">
          <h2 id="gst-return-schedule">Return schedule</h2>
          <p className="obligation-page__section-description">
            Live visibility of business activity statements and long-lead adjustments.
          </p>
        </div>
        <ul className="obligation-page__list">
          {gstReturns.map((gstReturn) => (
            <li key={gstReturn.period} className="obligation-page__item">
              <div>
                <p className="obligation-page__item-title">{gstReturn.period}</p>
                <p className="obligation-page__item-meta">Due {gstReturn.due}</p>
              </div>
              <span className="obligation-page__item-status">{gstReturn.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="gst-reconciliation" className="obligation-page__section">
        <div className="obligation-page__section-header">
          <h2 id="gst-reconciliation">Reconciliation workflow</h2>
          <p className="obligation-page__section-description">
            Tasks required to reconcile ledgers ahead of the next BAS submission.
          </p>
        </div>
        <ul className="obligation-page__list">
          {reconciliationTasks.map((task) => (
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
