import '../styles/page.css';
import './FocusArea.css';
import { FocusCard, statusToneClasses } from './pageCardUtils';

const paygwCards: FocusCard[] = [
  {
    title: 'PAYGW remittance cycle',
    status: { label: 'Due in 2 days', tone: 'caution' },
    summary:
      'Next withholding remittance is queued for 21 Oct. Confirm payroll reconciliation before submission.',
    highlights: [
      { label: 'Liability forecast', value: '$486K', emphasis: 'strong' },
      { label: 'Headcount on file', value: '142 employees' },
      { label: 'Banking channel', value: 'ANZ sweep (auto-scheduled)' }
    ],
    footer: 'ATO portal connection validated at 08:45 AEST.'
  },
  {
    title: 'Variance alerts',
    status: { label: 'On target', tone: 'positive' },
    summary:
      'No payroll variance beyond tolerance this fortnight. Monitor trend across high-volume entities.',
    highlights: [
      { label: 'Largest employer group', value: '$218K (Sydney operations)' },
      { label: 'Variance vs prior cycle', value: '-1.8%' },
      { label: 'Exception threshold', value: '±5%' }
    ],
    footer: 'All entity journals reconciled against ERP totals.'
  },
  {
    title: 'Exceptions requiring review',
    status: { label: '2 flagged entries', tone: 'critical' },
    summary:
      'Manual adjustments requested for contractor and bonus batches. Confirm supporting approvals.',
    highlights: [
      { label: 'Contractor adjustments', value: '$38K – missing TFN' },
      { label: 'Bonus true-up', value: '$24K – confirm approvals' },
      { label: 'Owner', value: 'PeopleOps / Payroll' }
    ],
    footer: 'Escalate outstanding exceptions before remittance sign-off.'
  }
];

export default function PaygwPage() {
  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">PAYGW controls</h1>
        <p className="page__description">
          Track withholding liabilities, variance alerts, and manual exception workflows tied to each payroll cycle.
        </p>
      </header>

      <section aria-label="PAYGW insights" className="page__grid">
        {paygwCards.map((card) => (
          <article className="page-card" key={card.title}>
            <header className="page-card__header">
              <h2 className="page-card__title">{card.title}</h2>
              {card.status ? (
                <span className={`page-card__status ${statusToneClasses[card.status.tone]}`}>
                  {card.status.label}
                </span>
              ) : null}
            </header>
            <p className="page-card__body focus-card__summary">{card.summary}</p>
            <ul className="page-card__list">
              {card.highlights.map((highlight) => (
                <li className="page-card__list-item" key={highlight.label}>
                  <span className="focus-card__list-label">{highlight.label}</span>
                  <span
                    className={[
                      'focus-card__list-value',
                      highlight.emphasis === 'strong' ? 'focus-card__list-value--strong' : ''
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {highlight.value}
                  </span>
                </li>
              ))}
            </ul>
            {card.footer ? <p className="focus-card__footer">{card.footer}</p> : null}
          </article>
        ))}
      </section>
    </div>
  );
}
