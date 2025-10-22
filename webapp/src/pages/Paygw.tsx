import './ObligationDetail.css';

const upcomingSubmissions = [
  {
    period: 'Fortnight ending 15 July',
    due: '21 August 2024',
    status: 'Awaiting payroll reconciliation',
  },
  {
    period: 'Fortnight ending 31 July',
    due: '4 September 2024',
    status: 'Draft in Xero',
  },
  {
    period: 'Fortnight ending 15 August',
    due: '18 September 2024',
    status: 'Pending CFO approval',
  },
] as const;

const actionItems = [
  {
    title: 'Match Single Touch Payroll totals',
    owner: 'Payroll operations',
    status: 'Due in 2 days',
  },
  {
    title: 'Confirm consolidated group remitter status',
    owner: 'Tax advisory',
    status: 'In review',
  },
  {
    title: 'Upload withholding variance memo',
    owner: 'Financial controller',
    status: 'Ready for sign-off',
  },
] as const;

export default function PaygwPage() {
  return (
    <div className="obligation-page">
      <header className="obligation-page__header">
        <h1>PAYGW obligations</h1>
        <p>
          Track upcoming pay-as-you-go withholding lodgements, ownership, and approval checkpoints
          before monthly submissions are due.
        </p>
      </header>

      <section aria-labelledby="paygw-upcoming" className="obligation-page__section">
        <div className="obligation-page__section-header">
          <h2 id="paygw-upcoming">Upcoming submissions</h2>
          <p className="obligation-page__section-description">
            Consolidated calendar of withholding periods and their statutory due dates.
          </p>
        </div>
        <ul className="obligation-page__list">
          {upcomingSubmissions.map((submission) => (
            <li key={submission.period} className="obligation-page__item">
              <div>
                <p className="obligation-page__item-title">{submission.period}</p>
                <p className="obligation-page__item-meta">Due {submission.due}</p>
              </div>
              <span className="obligation-page__item-status">{submission.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="paygw-actions" className="obligation-page__section">
        <div className="obligation-page__section-header">
          <h2 id="paygw-actions">Workflow</h2>
          <p className="obligation-page__section-description">
            Operational follow-ups required ahead of each submission cycle.
          </p>
        </div>
        <ul className="obligation-page__list">
          {actionItems.map((item) => (
            <li key={item.title} className="obligation-page__item">
              <div>
                <p className="obligation-page__item-title">{item.title}</p>
                <p className="obligation-page__item-meta">Owner: {item.owner}</p>
              </div>
              <span className="obligation-page__item-status">{item.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
