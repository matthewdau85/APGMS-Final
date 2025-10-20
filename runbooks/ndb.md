# Notifiable Data Breach (NDB) Runbook

This runbook guides the incident commander through the steps required when a potential Notifiable Data Breach (NDB) is identified.

## 1. Confirm the incident
- Validate the report with the on-call security engineer.
- Gather scope: affected systems, records, and time window.
- Determine whether the incident triggers the NDB scheme (serious harm test).

## 2. Contain and preserve evidence
- Isolate impacted infrastructure while maintaining availability for critical services.
- Capture forensic artifacts (logs, snapshots, database exports) and store them in the incident bucket.
- Rotate credentials that may have been exposed.

## 3. Escalate internally
- Page the executive sponsor (COO) and security lead.
- Spin up the incident channel `#inc-ndb-<date>` with the communication lead and legal counsel.
- Assign owners for customer comms, regulator comms, forensics, and remediation.

## 4. Prepare notifications
Complete these templates before sending and store drafts in the incident drive.

### 4.1 Customer notification (email)
```
Subject: Important security update regarding your Birchal account

Hi <Customer Name>,

We recently detected unauthorised access to a Birchal system that may have exposed information linked to your organisation <Org Name>. The data affected includes <Data Types>. At this time we have no evidence of misuse.

What we are doing
- Contained the incident at <Containment Time>.
- Enabled enhanced monitoring and rotated all relevant credentials.

What you should do
- Reset passwords for Birchal-connected accounts.
- Review recent activity for anything unfamiliar and report anything suspicious to us immediately.

We have reported the incident to the OAIC in accordance with the Notifiable Data Breaches scheme. If you have questions please reply to this email or call our hotline on <Hotline Number>.

Regards,
Birchal Security Team
```

### 4.2 Regulator notification (OAIC portal)
```
Incident summary: <One-line description>
Date discovered: <UTC timestamp>
Likely harm: <Risk summary>
Containment actions: <Short list>
Number of individuals affected: <Count/estimate>
Points of contact: <Legal counsel + incident commander>
Supporting documents: Upload incident timeline and preliminary impact assessment.
```

### 4.3 Internal announcement (Slack)
```
Heads-up: we have declared an NDB incident (INC-<number>). All external communications must be coordinated through #inc-ndb-<date>. Do not share customer names or incident details outside that channel. Next update at <time>.
```

## 5. Execute notifications
- Send regulator notification within 72 hours of confirmation.
- Email impacted customers after legal review and before public disclosure.
- Update the status page template with an incident summary and remediation steps.

## 6. Post-incident activities
- Run the full retrospective within 7 days.
- Capture lessons learned and preventive actions in Jira.
- Update affected runbooks, playbooks, and controls.
