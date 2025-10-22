import { useMemo, useState } from 'react';
import '../styles/compliance.css';

type AuditCategory = 'PAYGW' | 'GST' | 'Security' | 'Compliance';

type AuditEntry = {
  id: number;
  category: AuditCategory;
  actor: string;
  action: string;
  recordedAt: string;
};

const categories: AuditCategory[] = ['PAYGW', 'GST', 'Security', 'Compliance'];

const auditEntries: AuditEntry[] = [
  {
    id: 1,
    category: 'PAYGW',
    actor: 'Andrea Ghosh',
    action: 'Uploaded remission support pack for Q4 variance review.',
    recordedAt: '2024-06-01T08:15:00+10:00'
  },
  {
    id: 2,
    category: 'GST',
    actor: 'Michael Torres',
    action: 'Acknowledged reconciled BAS statements for syndicated facility.',
    recordedAt: '2024-05-29T15:20:00+10:00'
  },
  {
    id: 3,
    category: 'Security',
    actor: 'Priya Kaur',
    action: 'Logged collateral register update for Helios mezzanine tranche.',
    recordedAt: '2024-05-27T12:05:00+10:00'
  },
  {
    id: 4,
    category: 'Compliance',
    actor: 'Oliver Chen',
    action: 'Archived authorised remission memo signed by Commonwealth Bank.',
    recordedAt: '2024-05-25T09:40:00+10:00'
  }
];

function formatDateTime(isoDate: string) {
  return new Date(isoDate).toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function AuditTrail() {
  const [activeCategories, setActiveCategories] = useState<AuditCategory[]>([...categories]);

  const toggleCategory = (category: AuditCategory) => {
    setActiveCategories((prev) =>
      prev.includes(category)
        ? prev.filter((value) => value !== category)
        : [...prev, category]
    );
  };

  const filteredEntries = useMemo(
    () =>
      auditEntries.filter((entry) =>
        activeCategories.includes(entry.category)
      ),
    [activeCategories]
  );

  return (
    <section className="compliance-card" aria-labelledby="audit-trail-heading">
      <header className="compliance-card__header">
        <div>
          <h2 id="audit-trail-heading" className="compliance-card__title">
            Audit trail
          </h2>
          <p className="compliance-card__subtitle">
            Review the definitive record of PAYGW and remission documentation actions across the
            team.
          </p>
        </div>
        <div className="chip-group" role="group" aria-label="Filter audit trail by category">
          {categories.map((category) => {
            const isActive = activeCategories.includes(category);
            return (
              <button
                key={category}
                type="button"
                className={`chip ${isActive ? 'chip--active' : ''}`}
                aria-pressed={isActive}
                onClick={() => toggleCategory(category)}
              >
                {category}
              </button>
            );
          })}
        </div>
      </header>
      <div className="table-container">
        <table className="data-table" aria-describedby="audit-trail-heading">
          <thead>
            <tr>
              <th scope="col">Recorded</th>
              <th scope="col">Category</th>
              <th scope="col">User</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.length === 0 ? (
              <tr>
                <td className="audit-trail__empty" colSpan={4}>
                  No audit entries for the selected categories.
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <time dateTime={entry.recordedAt}>{formatDateTime(entry.recordedAt)}</time>
                  </td>
                  <td>{entry.category}</td>
                  <td className="audit-trail__actor">{entry.actor}</td>
                  <td className="audit-trail__action">{entry.action}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
