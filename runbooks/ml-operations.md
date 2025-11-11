# ML Operations Runbook

## Services

- **ml-service** (Fastify, port `4006`)
  - Endpoints: `/risk/shortfall`, `/risk/fraud`, `/plan/compliance`, `/metrics`, `/health`.
  - Loads signed model manifest (`models/manifest.json`) verified against `models/public.pem`.
  - Prometheus metrics:
    - `ml_inference_duration_seconds{model,scenario}` — request latency histogram.
    - `ml_feature_drift_score{model,feature}` — rolling drift z-score per feature.

## Deployment gates

1. **Model integrity**
   - CI validates manifest signature using published key.
   - SHA-256 of each model file must match manifest entry.
2. **Bias & regression**
   - Add regression tests comparing score deltas vs prior release before promoting models.
   - Store evaluation artifacts alongside manifest for audit.
3. **Drift alerts**
   - Alert when `ml_feature_drift_score` exceeds `3.0` for any feature for 3 consecutive scrapes.
4. **Security scanning**
   - Image build runs dependency scan (`pnpm audit` / Snyk) and container image scan prior to deploy.

## Retraining cadence

- **Monthly scheduled retrain** aligned to BAS cycle close (first business day each month).
- **Ad-hoc retrain triggers**
  - Feature drift alert sustained > 24h.
  - Human override rate > 30% for any scenario in 7-day rolling window.
- **Retrain process**
  1. Export latest labelled events from analytics warehouse (fraud adjudications, payment-plan outcomes, shortfall remediation).
  2. Run feature pipeline + training in isolated project; compare AUC/F1 against last production model.
  3. Produce evaluation report and update `models/manifest.json` plus signature.
  4. Submit change for review (see approval workflow).

## Approval workflow

1. **Data Scientist** packages new manifest + metrics into Git PR, tagging Risk Lead + Platform Owner.
2. **Risk Lead** reviews fairness / bias regression report, signs off in PR comment.
3. **Platform Owner** verifies signature, staging smoke (`/risk/*` endpoints) and merges PR.
4. **Release** promoted via CD pipeline; production deploy requires successful smoke + synthetic gating tests.
5. **Post-release**
   - Monitor overrides via API dashboard (`/risk/insights`) for 48h.
   - Document release summary in ops log including manifest version and approvals.
