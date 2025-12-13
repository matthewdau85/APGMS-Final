# Privileged Actions Spec

## Definition
A privileged action is any action that:
- Creates, deletes, or materially changes org configuration
- Alters security posture (roles, keys, integrations)
- Triggers settlements or exports
- Disables services or changes enforcement policies

## Required properties
- Must be authenticated (admin or org-scoped privileged role)
- Must be authorized via explicit allow-list (authz matrix)
- Must emit an audit event including:
  - actorId, actorRole, orgId (if applicable)
  - action name + parameters (redacted as required)
  - requestId / correlationId
  - timestamp

## Break-glass
- Documented procedure for emergency access
- Time-boxed tokens or approvals
- Mandatory post-incident review

## Audit evidence
- See docs/assessor/specs/audit-immutability.md
