# Acceptance Tests (Pass/Fail)

These are the minimum acceptance criteria for "prototype is healthy".

## A-001 No contract drift
- Backend route schemas and frontend API client types match.
- Error response shapes are consistent across layers.

## A-002 Green engineering gates
All of the following complete successfully:
- pnpm install --frozen-lockfile
- pnpm typecheck
- pnpm test (or repo-equivalent unit/integration targets)
- pnpm readiness:all (or repo-equivalent)
- pnpm compliance:evidence
- pnpm backup:evidence-pack

## A-003 Evidence pack exists and is reviewable
- Evidence pack export produces a deterministic folder output.
- DSP/OSF evidence index links remain valid.

## A-004 Required product flows are at least scaffolded
Prototype demonstrates:
- One-way account model constraints (deposit-only semantics)
- BAS verification/remittance orchestration skeleton
- Reconciliation artefact generation + discrepancy logging scaffolding
- Dashboard/reporting scaffolding
