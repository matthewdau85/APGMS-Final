# STP/BAS integration status

## Overview
This document summarizes the current readiness of the Single Touch Payroll (STP) and Business Activity Statement (BAS) flows inside the APGMS monorepo. The goal was to (1) audit the STP payload builder under `services/payroll`, (2) run the Australian Taxation Office (ATO) STP conformance suite, (3) finish the BAS lodgement adapter under `providers/ato`, (4) register the integration on the ATO Digital Service Provider (DSP) portal, and (5) document the resulting flow.

## Repository gaps that block the requested work
* There is no `services/payroll` package in the repository (see the `services/` directory listing); the only payroll-related logic currently resides in `services/api-gateway`, `services/connectors`, and `shared/ledger` ingestion helpers. Without the expected module the STP payload encoder cannot be audited or compared to the current ATO XML/JSON schemas.
* The `providers/` tree only contains a `banking/` provider and no ATO client (see `providers/` listing). There is no BAS lodgement adapter, OAuth client, or test harness to extend.
* No ATO STP schema definitions or official conformance fixtures exist anywhere in the repo. A full STP compliance test suite requires confidential ATO DSP materials plus credentials that are not available inside this environment.
* Registering the integration on the DSP portal (obtaining Product ID, Device AUSkey replacement identifiers, or the new Machine Credential) requires interactive access to the ATO portal and organization-level legal approvals, none of which can be automated or completed inside this container.

Because of these gaps the requested engineering work cannot proceed until the missing modules, schemas, credentials, and business approvals are in place.

## Recommended next steps
1. **Create the STP payload module**: add a `services/payroll` package (or extend an existing service) that maps internal payroll contributions into the latest STP Phase 2 payload structure. Mirror the official `PayrollEvent` schemas published on the DSP hub and include strict validators so regression tests can catch drift.
2. **Check in the STP schemas and fixtures**: import the public JSON schema references plus any ATO-provided XML samples (redacted as required). Wire them into a `tests/stp` folder so we can unit test the payload builder without needing production credentials.
3. **Implement an ATO provider**: add `providers/ato` with clients for the STP and BAS APIs. Follow the ATO SBR SOAP endpoints or the modern REST equivalents, include mutual TLS support, and isolate credential loading so secrets never land in git.
4. **Automate the conformance suite**: once the above code exists, wrap the official ATO STP/BAS harness (usually provided as a Windows binary or SOAP suite) inside reproducible scripts (e.g., Docker + Wine or a mocked harness). Capture the pass/fail evidence artifacts under `artifacts/compliance/`.
5. **Complete DSP portal registration**: track the Product ID, Device AUSkey/Machine Credential IDs, and OSF questionnaire reference inside `docs/runbooks/compliance-monitoring.md` as required by the DSP guidelines.

## Evidence expectations once the gaps are resolved
* Git history showing the STP payload builder plus schema references.
* Automated conformance logs uploaded to `artifacts/compliance/`.
* Provider configuration describing how BAS lodgements are signed and transmitted.
* DSP portal registration receipts (Product ID, contact details, test window approvals) stored in the compliance runbook.

Until these prerequisites are satisfied, APGMS cannot claim STP/BAS production readiness.
