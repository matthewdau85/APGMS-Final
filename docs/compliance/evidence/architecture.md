# Architecture Evidence

## Layered Platform Overview
- **Data Layer:** Managed data lake with policy-enforced zones, lineage services, and automated retention agents. Integration with the metadata catalog enables auditors to trace inputs referenced in patent claims.
- **Model Lifecycle Layer:** Feature store, training orchestrator, and evaluation services instrumented with explainability toolchains and automated approval gates.
- **Deployment Layer:** Multi-region inference gateways, canary controllers, and observability stack providing drift, bias, and resilience telemetry.

## Control Mapping
| Patent Commitment | Architectural Control | Evidence Link |
| ----------------- | --------------------- | ------------- |
| Data governance | Metadata graph + retention agents | `docs/patent/platform-patent-draft.md#data-governance-commitments` |
| Explainability | Model card generator + attribution services | `docs/patent/platform-patent-draft.md#explainability-commitments` |
| Human oversight | Approval workflows + control center dashboards | `docs/patent/platform-patent-draft.md#human-oversight-commitments` |
| Resilience | Active-active orchestration + self-healing pipelines | `docs/patent/platform-patent-draft.md#resilience-commitments` |
| Security | Encryption, runtime hardening, threat monitoring | `docs/patent/platform-patent-draft.md#security-commitments` |

## Diagrams
- `architecture/stack-overview.drawio`: High-level component diagram showing data flow and governance controls.
- `architecture/resilience-topology.pdf`: Site-redundancy topology with failover pathways and monitoring hooks.

Diagram source files are stored in the `artifacts/architecture` directory and exported prior to regulatory submissions.
