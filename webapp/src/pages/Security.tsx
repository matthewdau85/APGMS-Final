import './ObligationDetail.css';

const assessments = [
  {
    title: 'APRA CPS 234 control attestation',
    due: '12 September 2024',
    status: 'Evidence gathering',
  },
  {
    title: 'Vendor penetration test (CorePay)',
    due: '7 October 2024',
    status: 'Testing underway',
  },
  {
    title: 'IRAP refresh',
    due: '30 November 2024',
    status: 'Scheduling with assessor',
  },
] as const;

const securityTasks = [
  {
    title: 'Roll out hardware security keys to finance team',
    owner: 'Identity & access',
    status: '40% complete',
  },
  {
    title: 'Review data retention policy exceptions',
    owner: 'Security governance',
    status: 'Blocked pending legal feedback',
  },
  {
    title: 'Update incident response playbook',
    owner: 'Cyber defence',
    status: 'Draft ready',
  },
] as const;

export default function SecurityPage() {
  return (
    <div className="obligation-page">
      <header className="obligation-page__header">
        <h1>Security obligations</h1>
        <p>
          Align control attestations, vendor testing, and remediation follow-ups in one place for
          security and risk stakeholders.
        </p>
      </header>

      <section aria-labelledby="security-assessments" className="obligation-page__section">
        <div className="obligation-page__section-header">
          <h2 id="security-assessments">Assessments</h2>
          <p className="obligation-page__section-description">
            Oversight of regulatory, customer, and third-party security requirements.
          </p>
        </div>
        <ul className="obligation-page__list">
          {assessments.map((assessment) => (
            <li key={assessment.title} className="obligation-page__item">
              <div>
                <p className="obligation-page__item-title">{assessment.title}</p>
                <p className="obligation-page__item-meta">Due {assessment.due}</p>
              </div>
              <span className="obligation-page__item-status">{assessment.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="security-actions" className="obligation-page__section">
        <div className="obligation-page__section-header">
          <h2 id="security-actions">Follow-ups</h2>
          <p className="obligation-page__section-description">
            Outstanding remediation items across identity, governance, and incident response.
          </p>
        </div>
        <ul className="obligation-page__list">
          {securityTasks.map((task) => (
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
