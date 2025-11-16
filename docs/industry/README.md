# Industry-specific PAYGW & GST coverage

The `shared/src/rules/industry-rules.json` catalog captures the PAYGW and GST
schedules that were reviewed with SMEs for hospitality, construction and
healthcare organisations. Each entry lists:

- **ATO reference** – which PAYGW schedule or GST ruling drives the
  calculation.
- **SME notes** – short excerpts from the discovery interviews that explain
  why a concession/exemption matters for the vertical.
- **Exemptions** – data-driven predicates the rule engine can evaluate at run
  time (e.g., apprentice counts, export ratios, seasonal workforce share).

The new rule engine (`shared/src/rules/engine.ts`) consumes that catalog and can
apply multiple schedules per industry as well as rate/amount adjustments when
exemptions are satisfied.

| Industry | PAYGW schedules | GST schedule | Example exemptions |
| --- | --- | --- | --- |
| Hospitality & Tourism | Schedule 2 casual + Schedule 1 salaried | Standard GST remittance | Seasonal roster discount, remote resort GST relief, micro-operator threshold |
| Construction & Trades | Schedule 5 apprentice + Schedule 13 contractor | Progress-claim GST | Apprentice offset, remote allowance discount, export zero-rate |
| Healthcare & Allied | Schedule 3 shift + Schedule 1 salaried | Mixed supplies GST | NFP GST suspension, bulk-bill rate discount, remote health loading |

See `docs/industry/configuration.md` for setup guidance.
