# Compliance Oversight Operations

## Purpose
Defines human-in-the-loop workflows for escalation, approval, and evidence capture to maintain compliance coverage across services.

## Escalation Workflow
1. **Trigger**: Compliance monitoring alerts (DSP controls, policy exceptions, audit requests) create incidents in Jira project `COMP-ESC`.
2. **Triage Lead**: Compliance Duty Officer (CDO) reviews new incidents within 2 business hours.
3. **Routing**: CDO assigns owning team via PagerDuty schedule `Compliance-OnCall` and posts summary in `#compliance-oversight` Slack.
4. **Response SLAs**:
   - Critical controls: acknowledgement within 1 hour, mitigation plan in 24 hours.
   - Non-critical controls: acknowledgement within 4 hours, mitigation plan in 3 business days.
5. **Executive Visibility**: Escalations breaching SLAs automatically notify the VP Compliance and CISO.

## Approval Workflow
1. **Request Submission**: Teams submit change or exception requests through the Compliance portal form, generating Jira issues tagged `Approval-Needed`.
2. **Review Board**: Weekly Compliance Review Board (CRB) meeting evaluates pending items, referencing risk assessments and control impacts.
3. **Decision Logging**: Outcomes recorded in the Jira issue with decision rationale, conditions, and expiration dates if applicable.
4. **Conditional Approvals**: Require verification steps tracked as subtasks. Compliance Ops monitors completion before marking approval effective.
5. **Appeals**: Teams may escalate denials to the Compliance Steering Committee with additional evidence within 10 business days.

## Evidence Capture Workflow
1. **Evidence Intake**: Control owners upload artefacts to the Evidence Locker (`artifacts/compliance/locker`) structured by control ID.
2. **Metadata Requirements**: Each submission includes control ID, period of performance, system scope, reviewer, and hash checksum.
3. **Verification**: Compliance Analysts validate artefacts within 5 business days, logging verification notes in the Evidence Tracker (`docs/compliance/evidence-tracker.xlsx`).
4. **Retention**: Evidence retained for 7 years with annual integrity checks using the compliance archival tooling.
5. **Audit Support**: During audits, analysts compile packages from verified artefacts and log distribution in the Audit Support register.

## Contacts
- **Compliance Duty Officer**: compliance-oncall@yourdomain.example
- **Compliance Operations Lead**: comp-ops@yourdomain.example
- **Audit Support Desk**: audit-support@yourdomain.example
