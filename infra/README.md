# Infrastructure Overview

## Deployment Topologies
| Topology | Directory | Purpose | Residency Notes |
| --- | --- | --- | --- |
| Local compose stack | `docker-compose.yml` + `infra/dev/` | Spins up Postgres, Redis, tax-engine stub, API gateway, worker, and Vite webapp for developer workflows. | Runs on developer laptops only with synthetic/anonymised data. |
| Onshore IaC stack | `infra/iac/` | Terraform root module that will provision production resources (networking, databases, Fastify services, workers). | Must target Australian regions/availability zones owned by approved vendors. Follow `docs/compliance/hosting.md`. |
| Observability | `infra/observability/` | Grafana dashboards plus future Prometheus tooling for the onshore stack. | Dashboards and telemetry endpoints must be deployed in the same AU facilities as production workloads. |

## Next Steps
1. Flesh out `infra/iac` with Terraform providers, backend state, and modules bound to `ap-southeast-2` (or other AU regions).
2. Store deployment evidence and vendor artefacts inside `artifacts/compliance/vendors/` for OSF audits.
3. Keep this README aligned with `docs/compliance/hosting.md` whenever you add or change a topology.
