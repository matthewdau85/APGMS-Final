# APGMS Demo Runbook (Production-like, Demo Mode)

## Demo positioning (opening line)
APGMS is a control-plane and evidence system for tax obligations: it ingests transaction feeds, enforces funding and reconciliation controls, orchestrates lodgment and payment steps, and produces regulator-grade evidence packs.

## Login + admin gating (required behavior)
- Login as user: you must NOT see the prototype entry button.
- Login as admin: you see one entry button: "Open APGMS Console (Demo Mode)".
- Direct URL protection: non-admin hitting /proto/* is redirected to the normal home.

## Left nav (production model)
Follow this IA in the demo:
1) Dashboard
2) Obligations
3) Ledger
4) Reconciliation
5) Evidence Pack
6) Controls & Policies
7) Incidents
8) Settings
9) Regulator Portal (read-only)

## Recommended demo structure
Use the app to click through the flow, and keep this file as your talk track.
In-app "Demo Guide" exists at /proto/demo for self-serve demos.

## Demo script (click-by-click)

### A) Dashboard (60-90 seconds)
Show:
- Period switcher (2025-Q1)
- Status tiles: Funded, Reconcile pending, Ready to lodge, Overdue risk
- Recent activity feed (events timeline)

Say:
- The dashboard is the operational truth: obligations, blockers, and control status by period.
- Everything is event-backed so we can generate evidence packs later.

Action:
- Toggle Simulation ON
- Wait for an event to arrive (default feed interval is 45 seconds)
- Call out: "Bank feed received", "Ledger posted", "Match suggestion created"

### B) Obligations (2-3 minutes)
Show:
- Obligation list grouped by tax type
- Lifecycle: Fund, Reconcile, Lodge, Pay, Evidence

Say:
- This is the workflow engine view. We enforce preconditions before lodgment or payment.

Actions:
- Open BAS 2025-Q1
- Click "Run reconciliation"
- If blockers exist, go to Reconciliation to resolve an unmatched feed line, then re-run reconciliation
- Click "Prepare lodgment (demo)"
- Click "Submit lodgment (demo)"
- Click "Generate evidence pack"

### C) Ledger (60-120 seconds)
Show:
- Ledger entries tagged by obligation, period, and source

Say:
- Ledger is the audit spine. Every derived figure traces back to entries and events.

Action:
- Filter to the obligation you just lodged (optional if filter is present)

### D) Reconciliation (2 minutes)
Show:
- Bank feed lines: matched, unmatched, suggested
- Exceptions behavior

Say:
- This is the control gate. We do not allow lodgment based on unverified inputs.

Action:
- Resolve one unmatched item (mark business, tax, or excluded)

### E) Evidence Pack (2 minutes)
Show:
- Evidence pack list by period and obligation
- Manifest hash + pack items + "What changed" section

Say:
- This is the artifact you hand to an assessor/regulator. It is reproducible: same inputs, same outputs, same hashes.

### F) Controls & Policies (90 seconds)
Show:
- Funding policy
- Reconciliation policy
- Access policy

Say:
- Controls are explicit and versioned. You can show exactly which policy version was in force for any event.

Action:
- Save a policy change (demo) and note the policy update event

### G) Incidents (90 seconds)
Show:
- Incident list: severity, status, timestamps
- Create incident

Say:
- Incidents are first-class so operational failures become explainable and evidenced.

Action:
- Create "Feed delay" incident and optionally link it to BAS

### H) Settings (2-3 minutes)
Show sections:
- Organization: name, ABN (demo), time zone, reporting calendar
- Period & obligations: cadence, due date rules, reminders
- Accounts: operating, tax buffer, segregated mapping
- Integrations: bank feed/accounting/payroll (demo states)
- Notifications: email/webhook toggles
- Security: MFA policy, session timeout, admin roles
- Data retention: event + evidence retention
- Export: evidence defaults, regulator portal
- Simulation: seed + interval (default is less frequent)

Say:
- Settings is where APGMS becomes deployable per organization while staying compliant and auditable.

Action:
- Adjust Simulation interval (for the demo, keep it slower)
- Optionally reset demo state to restart the narrative

### I) Regulator Portal (read-only) (90 seconds)
Show:
- Read-only compliance summary for the period
- Packs/incidents counters
- No write actions

Say:
- This is the assessor view: minimum necessary access with reproducible artifacts.

## Reset rule (determinism)
If anything drifts during a live demo, use "Reset demo state" so steps behave the same again.
