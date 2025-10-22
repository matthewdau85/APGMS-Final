# Status site

Our customer-facing status experience is in-flight. The table below records what exists today and what is planned so stakeholders can track progress without overstating the current posture.

| Capability | Current State | Planned Work | Owner | Evidence |
| --- | --- | --- | --- | --- |
| Public status page | No dedicated status frontend exists yet; outages are communicated manually using incident channels and direct messaging. | - [ ] Build a static status microsite in this repository (`status/` directory) sourced from uptime monitors (TBD – create PR). | Customer Experience Engineering | [`status/`](./)<br>[CI workflow](https://github.com/matthewdau85/APGMS-Final/actions/workflows/ci.yml) |
| Incident communications | Teams rely on the Notifiable Data Breach runbook for structured customer and regulator updates while the status tooling is unfinished (`runbooks/ndb.md`). | - [ ] Draft status-specific messaging templates and link them to incident command checklists (TBD – create PR). | Security Operations & Comms | [`runbooks/ndb.md`](../runbooks/ndb.md) |
| Monitoring integration | No automated signal currently feeds into a status dashboard; engineers check service health via ad-hoc scripts and Fastify `/health` endpoints (e.g. `services/api-gateway/src/app.ts`). | - [ ] Wire Fastify health checks and synthetic tests into a shared uptime monitor that can publish status events (TBD – create PR). | Platform Reliability | [`services/api-gateway/src/app.ts`](../services/api-gateway/src/app.ts)<br>[Security workflow](https://github.com/matthewdau85/APGMS-Final/actions/workflows/security.yml) |

Once the planned items gain PR tracking IDs they will be appended next to the task checkboxes for traceability.
