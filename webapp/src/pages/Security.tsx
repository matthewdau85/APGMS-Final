import '../styles/page.css';
import './FocusArea.css';
import { FocusCard, statusToneClasses } from './pageCardUtils';

const securityCards: FocusCard[] = [
  {
    title: 'Identity posture',
    status: { label: 'All admins MFA enforced', tone: 'positive' },
    summary: 'Privileged access monitoring shows compliant MFA and device hygiene across regional teams.',
    highlights: [
      { label: 'Critical roles', value: '37 accounts', emphasis: 'strong' },
      { label: 'Inactive credentials', value: '5 pending disablement' },
      { label: 'Latest review', value: 'Completed 19 Oct' }
    ],
    footer: 'Azure AD export matched to internal HR roster overnight.'
  },
  {
    title: 'Network monitoring',
    status: { label: 'Review incident 2308-17', tone: 'caution' },
    summary: 'Northbound traffic spike detected in Sydney colo. Validate IDS tuning post change window.',
    highlights: [
      { label: 'Anomaly duration', value: '14 minutes' },
      { label: 'Packets inspected', value: '1.2M – 0.8% flagged' },
      { label: 'Owner', value: 'SecOps on-call' }
    ],
    footer: 'Core switch firmware patch planned for Friday maintenance window.'
  },
  {
    title: 'Vendor access',
    status: { label: '2 certifications expired', tone: 'critical' },
    summary: 'Third-party data processors require renewed SOC2 reports before access renewals next quarter.',
    highlights: [
      { label: 'Vendors', value: 'Helix Analytics / CloudScale' },
      { label: 'Data classification', value: 'Confidential datasets' },
      { label: 'Next step', value: 'Legal to enforce remediation plan' }
    ],
    footer: 'Notify procurement to suspend new workloads until certificates received.'
  }
];

export default function SecurityPage() {
  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Security operations</h1>
        <p className="page__description">
          Maintain visibility across identity, network, and vendor access programs powering the institutional portfolio.
        </p>
      </header>

      <section aria-label="Security insights" className="page__grid">
        {securityCards.map((card) => (
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
