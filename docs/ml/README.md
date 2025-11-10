# Machine Learning Performance Gates

This document captures the baseline evaluation criteria for ml-core models. Each gate is
tuned to balance fraud prevention with cash-flow resilience for small businesses.

## Fraud Alert Precision

- **Target:** 0.92 precision @ 10% recall on out-of-sample fraud alerts.
- **Rationale:** Operations can only triage a limited number of alerts per week; a
  precision floor ensures analysts spend time on credible fraud risks.
- **Measurement:** Evaluate on the hold-out alert dataset exported from the ledger
  surveillance system. Precision is measured on the top decile of model scores.

## Shortfall Detection Recall

- **Target:** 0.85 recall @ 0.50 precision on payroll shortfall scenarios.
- **Rationale:** Missing shortfall cases creates compliance exposure. We bias toward
  higher recall while maintaining a workable review volume.
- **Measurement:** Derived from scenario replays that compare required vs. secured
  balances across BAS cycles. Recall is computed against confirmed shortfalls flagged by
  reconciliation analysts.

## Drift Monitoring

- **Target:** No more than a 10% drop in either precision or recall over any rolling
  30-day window.
- **Rationale:** Ensures model updates or data drift are detected quickly.
- **Measurement:** Weekly retraining jobs produce evaluation artifacts stored via the
  experiment logging utilities in `ml_core.experiments.logging`.
