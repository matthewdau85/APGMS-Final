# Forecasting benchmark summary

## Pilot dataset
- Source: `data/pilot/analytics/pilot-cycles.json` captures four pilot organisations with six historical BAS cycles each plus the most recent actuals for PAYGW and GST obligations.
- The dataset is built from payroll/POS fixtures used in compliance pilots so analysts can replay the same slice in demos, scripts, or notebooks without touching production data.

## Evaluation process
- Run `pnpm --filter @apgms/analytics pilot:evaluate` to load the pilot dataset, execute the shared EWMA and regression models, and emit structured results to `artifacts/analytics/`.
- The script now also generates `model-monitoring-dashboard.json`, a simplified feed for dashboards or ops runbooks that tracks which orgs are drifting beyond their confidence interval.

## Accuracy results
| Model | PAYGW MAE | PAYGW MAPE | GST MAE | GST MAPE |
| --- | --- | --- | --- | --- |
| EWMA | 1,370.87 | 7.13% | 517.28 | 4.45% |
| Regression | **87.82** | **0.51%** | **160.46** | **1.36%** |

- Regression reduces PAYGW mean absolute error by ~94% relative to the older EWMA baseline on the pilot dataset, and it cuts GST error by ~69%.
- None of the pilot observations fell within the 95% EWMA confidence interval, which is why the alerting service now surfaces confidence bands and requires schedule tuning before escalation.

## Monitoring and next steps
1. Use `artifacts/analytics/pilot-model-evaluation.json` when briefing stakeholders; it includes per-org error, coverage, and narrative context for each prediction.
2. Point Grafana/Looker dashboards at `artifacts/analytics/model-monitoring-dashboard.json` so ops can watch org-level deviations, the regression deltas, and the current watchlist without opening a notebook.
3. Iterate on the pilot dataset quarterly (add more sectors or live pilot exports) so the regression trendlines stay honest and the EWMA baseline keeps decaying when it underperforms.
