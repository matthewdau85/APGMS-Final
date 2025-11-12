# DSP Number Pattern Pilot Runbook

The DSP number pattern feature ships as a 90-day pilot that is tightly
controlled via feature flags and isolated telemetry. This runbook covers how
to manage the rollout, what data must be retained, how to evaluate pilot
health, and when to shut the feature back down.

## Feature Flag Procedures
- **Primary flag**: `dsp-number-pattern.enabled` (exposed in LaunchDarkly).
- **Scoped rollout**: Target the pilot cohort only. Do not enable the flag for
  the global environment until the exit criteria are met.
- **Emergency disable**: Use the LaunchDarkly kill switch to flip the flag off
  for all environments. Confirm that the `dsp_pilot_rollout_status` metric
  drops to zero within two Prometheus scrapes.
- **Config drift checks**: Every deploy runs `./scripts/feature-flags audit`
  which validates that the expected pilot targets remain in place. Treat any
  diff as a release blocker.

## Retention Policy
- **Pilot interaction logs**: Retain for 180 days to support regulator review.
- **Anonymised aggregates**: Keep indefinitely; they back the KPI dashboards.
- **Raw customer inputs**: Purge after 30 days unless tied to an open
  investigation. Add the ticket ID to the retention exception log if a hold is
  required.
- **Support escalations**: Store in the compliance archive following SOP-17.

## Pilot Scope
- Cohort: 12 enterprise customers listed in `providers/dsp/pilot-cohort.json`.
- Channels: Web app + API gateway. No ingestion from batch pipelines.
- Geography: US-only numbers. Block EMEA/APAC traffic via the feature flag
  targeting rules.
- Dependencies: Requires the segmentation service `segmentation-v2` at or
  above build `2025.03.18`.

## KPIs
- **Pattern match precision** ≥ 92% weekly.
- **False positive rate** ≤ 3% of reviewed cases.
- **Average mute duration** < 4 hours.
- **Segmentation freshness**: 95% of DSP entities refreshed in the last 24
  hours.
- **Support volume delta**: < 10% increase over baseline.

Prometheus counters and Grafana dashboards (see `services/api-gateway/src` and
`infra/observability/grafana/dashboards.json`) track these KPIs. Investigate if
any KPI breaches its threshold for two consecutive days.

## Exit Criteria
- KPI targets are met or exceeded for four consecutive weeks.
- Pilot cohort reports ≥ 8/10 satisfaction (survey instrument `DSP-PILOT-01`).
- No Sev-1 or Sev-2 incidents attributable to the feature in the past 30 days.
- Compliance sign-off confirming retention and auditing controls met.
- After exit approval, schedule a release window to promote the flag to the
  general population. Document the change in the release journal.
