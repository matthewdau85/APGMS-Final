# Monthly compliance scorecard – November 2024

The compliance scorecard consolidates security, privacy, and accessibility indicators for
executive review. Metrics pull from the compliance data warehouse and are refreshed hourly,
with predictive trend lines surfaced in the live Tableau dashboard. The raw extracts and the
PDF sent to leadership are archived under `artifacts/compliance/` to preserve an auditable trail.

## Control posture summary

| Domain | Indicator | Target | Current | Trend | Notes |
| --- | --- | --- | --- | --- | --- |
| Security | ASVS Level 2 controls on track | 100% | 100% | ↔ Stable | Device-bound refresh tokens deployed; automated monitor validates hourly. |
| Privacy | Evidence freshness within cadence | ≥ 98% | 99% | ↗ Improving | Vendor telemetry connected; automated attestations reducing lag. |
| Accessibility | WCAG Level A/AA issues resolved within SLA | ≥ 95% | 96% | ↔ Stable | All backlog items within SLA; ongoing usability research feeding roadmap. |
| Training | Control owner refresher completion | 100% | 100% | ↔ Stable | Micro-learning nudges triggered ahead of due dates. |
| Risk | Open high residual risks | ≤ 2 | 0 | ↔ Stable | R-07 mitigated to medium pending pen-test validation. |
| Vendor | High-risk vendor assurance coverage | 100% | 100% | ↔ Stable | Continuous monitoring live via shared Snowflake feed. |
| Predictive drift | Controls flagged for potential breach in 30 days | 0 | 0 | ↔ Stable | Forecast engine shows no red flags; next review 08 Nov. |

## Exception register highlights

- **COMP-91** – Automate TFN SOP walkthrough capture in evidence vault; due 12 Nov 2024.
- **VRM-133** – Third-party LLM provider real-time log feed attestation; due 15 Nov 2024.
- **A11Y-361** – Dark mode contrast audit automation; targeted for sprint 2024-45 release.

## Upcoming milestones

| Date | Milestone | Owner | Dependency |
| --- | --- | --- | --- |
| 2024-11-05 | Predictive drift model v2 launch | Risk Analytics Lead | Feature store deployment complete |
| 2024-11-08 | External advisor benchmarking session | Compliance Ops Lead | Provide 30-day evidence snapshot |
| 2024-11-15 | Customer assurance portal GA | Security PM | Finalise access logging enhancements |
| 2024-11-20 | Quarterly guild summit | Compliance Ops Lead | Aggregate insights from audits and user research |

## Data sources

- Compliance data warehouse (BigQuery) table `compliance.scorecard_daily`
- Jira projects `COMP`, `VRM`, `A11Y`
- LMS webhook export stored in `/training/exports/`
- Tableau dashboard `Compliance – Exec Overview`
- Looker Explore `Predictive Compliance Drift`
- Archived PDF: `artifacts/compliance/2024-11 - Compliance Scorecard.pdf`

### Reproducible query snippets

```sql
-- Evidence freshness computation
SELECT
  control_family,
  SUM(CASE WHEN age_in_days <= cadence_days THEN 1 ELSE 0 END) / COUNT(*) AS freshness_ratio
FROM compliance.evidence_freshness
WHERE snapshot_date = '2024-11-01'
GROUP BY control_family;

-- Predictive drift indicator
SELECT
  control_id,
  forecast_window_days,
  breach_probability
FROM compliance.predictive_drift
WHERE forecast_window_days = 30
  AND snapshot_date = '2024-11-01'
ORDER BY breach_probability DESC;
```

## Distribution

The scorecard is posted to Slack channels `#exec-weekly` and `#compliance-help` on the first
business day of each month. Leadership reviews highlights during the Compliance Steering
Committee meeting, and the live dashboard is shared with strategic partners via the Snowflake
data share. Action items are tracked in the meeting minutes and mirrored in ServiceNow.
