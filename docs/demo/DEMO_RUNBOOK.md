# APGMS Prototype Demo Runbook (production-like talk track)

## One-line positioning (opening sentence)
"APGMS is a control-plane and evidence system for tax obligations: it ingests transaction feeds, enforces funding and reconciliation controls, orchestrates lodgment and payment steps, and produces regulator-grade evidence packs."

## Login + Admin gating (required behavior)
- Login as user: you should NOT see the prototype entry button.
- Login as admin: you see a single entry button: "Open APGMS Console (Demo Mode)".
- Direct URL protection: if a non-admin hits /proto/*, they are redirected away.

## Demo navigation order (production model)
1) Dashboard
2) Obligations
3) Ledger
4) Reconciliation
5) Evidence Pack
6) Controls & Policies
7) Incidents
8) Settings
9) Regulator Portal (read-only)

## A) Dashboard (60-90 seconds)
Show:
- Period switcher (e.g., 2025-Q1)
- Status tiles
- Recent activity timeline
Say:
- "The dashboard is the operational truth: obligations, blockers, and control status by period."
- "Everything here is event-backed so we can generate evidence packs later."
Action:
- Toggle Simulation: ON
- Wait for a feed event to arrive (default cadence is less frequent: 60 seconds).

## B) Obligations (2-3 minutes)
Show:
- Obligation list grouped by tax type (demo)
- Lifecycle: Fund -> Reconcile -> Lodge -> Pay -> Evidence
Say:
- "This is the workflow engine view. We enforce preconditions before lodgment or payment."
Actions (in an obligation detail):
- Run reconciliation
- Prepare lodgment
- Submit lodgment (demo)
- Queue payment (demo)
- Generate evidence pack

## C) Ledger (60-120 seconds)
Show:
- Ledger entries tagged by obligation, period, and source
Say:
- "Ledger is the audit spine. Every derived figure traces to ledger entries and events."
Action:
- Filter to the obligation you just processed and show the entries.

## D) Reconciliation (2 minutes)
Show:
- Bank lines and statuses
Say:
- "This is the control gate. We do not allow lodgment based on unverified inputs."
Action:
- Highlight unmatched lines (simulation can generate them).

## E) Evidence Pack (2 minutes)
Show:
- Evidence pack list and open one pack
Say:
- "This is the artifact you hand to an assessor/regulator. It's reproducible: same inputs, same outputs, same hashes."

## F) Controls & Policies (90 seconds)
Show:
- A policy toggle that updates export defaults
Say:
- "Controls are explicit and versioned. You can show which version was in force for any event."

## G) Incidents (90 seconds)
Show:
- Incident list
Action:
- Create an incident and link it to an obligation
Say:
- "Incidents are first-class so operational failures become explainable and evidenced."

## H) Settings (2-3 minutes)
Show sections:
- Organization
- Period & obligations
- Accounts
- Integrations (mocked)
- Notifications
- Security
- Data retention
- Export defaults
- Analytics (demo)
- Simulation cadence
- Reset demo state

## I) Regulator Portal (read-only) (90 seconds)
Show:
- Read-only compliance summary
- Evidence packs list
- Incidents list
Say:
- "This is the assessor view: minimum necessary access, with reproducible artifacts."

## Operational demo rule
- Simulation cadence is intentionally less frequent by default (60s). Adjust in Settings if needed.
- Use Reset demo state before important demos to ensure a clean story.
