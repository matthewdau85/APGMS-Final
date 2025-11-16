# STP/BAS integration readiness

This document tracks the implementation status of the Australian Taxation Office (ATO) Single Touch Payroll (STP) Phase 2 flow and the Business Activity Statement (BAS) lodgement integration that now live inside the repository.

## Repository components

| Area | Location | Notes |
| --- | --- | --- |
| STP payload builder | `services/payroll` | Converts internal payroll events into the STP Phase 2 payload and validates against the current JSON schema. |
| STP/BAS conformance tests | `services/payroll/tests/stp.conformance.test.ts` | Executes the published ATO fixtures and enforces schema compatibility using Ajv. |
| ATO transport clients | `providers/ato` | Provides STP and BAS lodgement clients that handle signing metadata and software identifiers. |
| DSP registration record | `providers/ato/registration/manifest.json` | Stores the Product ID, software ID, and machine credential metadata captured on the ATO DSP portal. |
| Evidence snapshots | `artifacts/compliance/stp-conformance-report.md` | Stores the latest conformance output captured from CI. |

## STP payload auditing

* The STP encoder accepts strongly typed `PayrollEventInput` objects describing the pay run, payer, and employee breakdowns.
* The payload builder (`services/payroll/src/payloadBuilder.ts`) normalises each employee record, applies allowance/deduction adjustments, and stamps metadata such as the transmission ID and software ID.
* Every payload is validated against `services/payroll/src/schemas/stp-phase-2.json`, a JSON Schema representation of the latest DSP hub specification.
* The validator is exposed through `buildStpPayload`/`validateStpPayload` so the API gateway and background workers can compose and assert STP payloads without duplicating logic.

### Running the audit locally

```bash
pnpm --filter @apgms/payroll test
```

The test harness imports the official fixtures under `services/payroll/tests/fixtures` and fails if any attribute drifts from either the JSON schema or the expected payload published by the ATO certification suite.

## Automated conformance tests

* The Jest test `services/payroll/tests/stp.conformance.test.ts` asserts that the generated payload for the sample pay event exactly matches the ATO-provided golden file and is valid under the schema.
* CI invokes the test via `pnpm -r test`, guaranteeing that every branch run captures an STP conformance artefact.
* The latest run is exported to `artifacts/compliance/stp-conformance-report.md` so auditors can review timestamps, commit hashes, and raw command output without needing to reproduce the run locally.

## BAS lodgement client

* `providers/ato/src/basClient.ts` implements the `/bas/v2/lodgements` and `/bas/v2/lodgements/:id` calls required to submit BAS statements and poll their status.
* The client shares the same mutual TLS envelope builder used by the STP client so that the Machine Credential recorded on the DSP portal is consistently applied.
* Workloads can import the helper as follows:

```ts
import { AtoBasClient } from "@apgms/ato";
const credential = loadMachineCredential();
const basClient = new AtoBasClient(credential, { baseUrl: process.env.ATO_BASE_URL! });
await basClient.submitBas(basStatement);
```

## DSP registration details

* The DSP portal registration snapshot at `providers/ato/registration/manifest.json` captures the product ID, machine credential alias, and compliance contact information.
* Update this manifest whenever the ATO assigns a new Product ID, software ID, or Machine Credential so the code and operational runbooks stay in sync.

## Evidence capture

1. Run the compliance suite: `pnpm --filter @apgms/payroll test`.
2. Execute the evidence collector: `pnpm compliance:evidence -- --tag stp-bas`.
3. Attach the generated markdown file from `artifacts/compliance` to the evidence package shared with the DSP portal.

The resulting artefact now includes the STP and BAS coverage required to demonstrate readiness to the ATO.
