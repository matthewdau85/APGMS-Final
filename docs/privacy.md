# APP 12/13 Request Handling

This document outlines how Birchal satisfies Australian Privacy Principles (APP) 12 and 13 covering access to, and correction of, personal information.

## Overview
- **APP 12** gives individuals the right to access personal information we hold about them.
- **APP 13** requires us to correct personal information to ensure it is accurate, up-to-date, and complete.
- All requests are tracked in the Privacy ServiceDesk queue with the label `app-12-13`.

## Intake process
1. Requests may arrive via support@birchal.com, the privacy webform, or regulator correspondence.
2. Support triages within one business day and escalates to the Privacy Officer.
3. The Privacy Officer logs the request with: requester name, contact details, relationship to Birchal, verification status, and due date.

## Identity verification
- For customers, request confirmation from the registered email or phone on file.
- For authorised representatives, obtain a signed authority letter less than 12 months old.
- Log verification steps in the request ticket. If identity cannot be verified, respond with refusal citing APP 12.3.

## Locating information
1. Query the data inventory for systems tagged with the requester's organisation ID.
2. Run `/admin/export/:orgId` in the API Gateway using an approved admin JWT (Authorization: Bearer ...) to gather structured exports.
3. Collect additional artefacts: audit logs, support transcripts, manual files stored in Google Drive.
4. Store copies in the encrypted privacy evidence folder with restricted permissions.

## Responding to access requests (APP 12)
- Default timeframe: 30 calendar days.
- Provide a summary report including:
  - Data sources accessed.
  - Categories of personal information (contact details, transaction history, audit events).
  - Any redactions and the reason for withholding (e.g. another individual's privacy).
- Use the customer notification template in `runbooks/ndb.md` if the request stems from a breach incident.
- Deliver securely via the customer portal or encrypted email (password shared via phone).

## Responding to correction requests (APP 13)
1. Validate the requested changes and supporting evidence.
2. Update authoritative systems (CRM, registry, billing) and log the fields changed.
3. Issue a confirmation email detailing the updates made.
4. If refusing to correct, provide written reasons, available complaint mechanisms, and contact information for the OAIC.

## Escalation and reporting
- Notify the Chief Privacy Officer if the request relates to more than 100 individuals or involves regulator oversight.
- Breach the timeframe? file an incident and inform the requester of the delay and revised completion date.
- Quarterly metrics: number of APP 12 requests, response time distribution, number of corrections, and refusals with reasons.

## Record keeping
- Retain all correspondence, exports, and correction evidence for seven years.
- Store final responses in the Privacy ServiceDesk ticket and tag with `closed-app-12-13`.
- Update this procedure annually or after any significant regulatory change.
