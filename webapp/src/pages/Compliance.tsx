import '../styles/page.css';
import './FocusArea.css';
import { FocusCard, statusToneClasses } from './pageCardUtils';

const complianceCards: FocusCard[] = [
  {
    title: 'Entity filings pipeline',
    status: { label: '3 due this week', tone: 'caution' },
    summary:
      'Coordinated ASIC and state-based filings with director certifications pending. Sync with legal for sign-off.',
    highlights: [
      { label: 'ASIC submissions', value: '2 awaiting director approval' },
      { label: 'State licensing', value: 'QLD energy retail renewal' },
      { label: 'Document room', value: 'All artefacts uploaded' }
    ],
    footer: 'Reminder: notify CFO before lodging finance subsidiary amendments.'
  },
  {
    title: 'Policy attestations',
    status: { label: 'Completion 96%', tone: 'positive' },
    summary: 'Annual policy attestations across treasury, risk, and HR programs are closing on schedule.',
    highlights: [
      { label: 'Outstanding respondents', value: '12 – mostly contractors' },
      { label: 'Escalations triggered', value: '4 automatic reminders sent' },
      { label: 'Owner', value: 'Risk & Assurance' }
    ],
    footer: 'Platform: ServiceNow attestation workflow (APAC region).'
  },
  {
    title: 'Control exceptions',
    status: { label: '1 high severity', tone: 'critical' },
    summary:
      'Vendor onboarding control flagged missing beneficial ownership check for US subsidiary expansion.',
    highlights: [
      { label: 'Control', value: 'AML-KYC onboarding' },
      { label: 'Impact', value: 'Pause fund drawdown until cleared' },
      { label: 'Next review', value: 'Audit committee 24 Oct' }
    ],
    footer: 'Exception owner: Compliance lead – follow-up call scheduled today 15:00.'
  }
];

export default function CompliancePage() {
  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Compliance hub</h1>
        <p className="page__description">
          Centralise regulatory filings, attestations, and control break management for the portfolio’s operating entities.
        </p>
      </header>

      <section aria-label="Compliance insights" className="page__grid">
        {complianceCards.map((card) => (
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
