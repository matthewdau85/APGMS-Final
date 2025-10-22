# Reliability & Operations Scorecard

- **Score:** 5 / 5
- **What changed:** Dependency brownouts now trigger automated load shedding for write paths, Prometheus exports SLO/error budget metrics that back Alertmanager rules, and CI runs synthetic transaction probes against the API gateway to detect regressions before deploy.
- **Next steps:** Maintain alert routing and review the synthetic probes quarterly to ensure they continue covering business-critical user journeys.
