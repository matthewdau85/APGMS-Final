import '../styles/page.css';
import './FocusArea.css';
import { FocusCard, statusToneClasses } from './pageCardUtils';

const gstCards: FocusCard[] = [
  {
    title: 'Current BAS draft',
    status: { label: 'Review by 28 Oct', tone: 'caution' },
    summary:
      'Draft BAS lodgement reflects consolidated entity data. Reconcile input credits before submission.',
    highlights: [
      { label: 'Net GST payable', value: '$312K', emphasis: 'strong' },
      { label: 'Input credits pending', value: '$84K – 3 invoices unapproved' },
      { label: 'Automations', value: 'Hubdoc ingestion 97% complete' }
    ],
    footer: 'ATO SBR integration healthy – last sync 11:20 AEST.'
  },
  {
    title: 'Industry benchmark',
    status: { label: 'Utilisation 92% captured', tone: 'positive' },
    summary: 'Entity classifications align with energy portfolio benchmark. Monitor cash basis subsidiaries.',
    highlights: [
      { label: 'GST on capital projects', value: '$128K' },
      { label: 'Deferred adjustments', value: '$46K – amortised' },
      { label: 'Variance vs prior BAS', value: '+3.1%' }
    ],
    footer: 'Benchmark dataset refreshed with ABS October release.'
  },
  {
    title: 'Risk signals',
    status: { label: '1 threshold breach', tone: 'critical' },
    summary: 'Utility vertical triggered anomaly for March acquisition entity. Investigate rapid credit claims.',
    highlights: [
      { label: 'Entity', value: 'GridFlex No.3 Pty Ltd' },
      { label: 'Credit spike', value: '+$62K vs rolling average' },
      { label: 'Owner', value: 'Tax & Treasury squad' }
    ],
    footer: 'Auto-workflow generated Jira ticket TAX-2487 for follow-up.'
  }
];

export default function GstPage() {
  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">GST position</h1>
        <p className="page__description">
          Surface BAS readiness, benchmark trends, and anomaly detection across the portfolio’s indirect tax program.
        </p>
      </header>

      <section aria-label="GST insights" className="page__grid">
        {gstCards.map((card) => (
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
