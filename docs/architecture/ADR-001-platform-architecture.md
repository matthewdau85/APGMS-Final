# ADR-001: Platform Architecture & Tenancy

## Status
Accepted – 2025-10-24

## Context
The APGMS platform requires a modular architecture that supports secure ingestion of payroll, POS, and banking data, reconciles obligations in near real-time, and exposes auditable services that satisfy ATO DSP obligations. The existing monorepo already contains an API gateway (`services/api-gateway`) and shared libraries (`shared`). We need a lightweight backbone that can evolve towards the fully featured system outlined in the multi-phase rollout plan without blocking ongoing development.

## Decision
We will adopt a service-oriented topology composed of:

1. **Ingestion Adapters** (`@apgms/ingestion-adapters`) – capture external events, apply deterministic calculations (e.g., PAYGW, GST), and publish normalised events to an internal event bus. Initially the bus is in-memory (for demos/tests) but the service boundary is designed for Kafka/NATS later.
2. **Ledger & Reconciliation Service** (future) – consumes ingestion events, persists to an append-only ledger, and raises discrepancy alerts. This will reuse the shared messaging primitives added in this ADR.
3. **BAS Orchestrator** (future) – reads ledger state and initiates BAS workflows, integrating with the banking adapter for fund releases.
4. **API Gateway** – remains the entry point for UI and partner integrations, reusing shared modules for masking, authentication, and tax calculations.
5. **Shared Library Enhancements** – new reusable modules (`@apgms/shared/tax`, `@apgms/shared/messaging`) provide deterministic calculation helpers and a typed event bus abstraction.

Tenancy is enforced through the event payloads: every emitted event carries an `orgId`, and downstream services must validate scope before mutating state. The simulation sandbox (planned Phase 4) will run in isolated tenants using the same primitives.

## Consequences

- Enables incremental delivery: services can subscribe to ingestion events without tight coupling.
- Shared tax logic ensures PAYGW/GST calculations stay consistent across services and the gateway.
- The in-memory bus keeps local development and tests self-contained while providing a pathway to a production-grade broker.
- Future services (ledger, orchestrator) can be scaffolded rapidly because message contracts and helper utilities already exist.
- We must harden event schemas and introduce schema registry tooling in later phases when moving to a distributed message broker.

## Follow-up

- Implement ledger persistence and schema validation (Phase 1/2).
- Replace in-memory bus with Kafka/NATS bindings once infrastructure is provisioned.
- Extend ADR catalogue with decisions on vault integration, reconciliation storage, and orchestrator workflow engine when those components are implemented.

## Evidence

- EV-001: Platform architecture evidence (`docs/evidence/EV-001-platform-architecture.md`)
