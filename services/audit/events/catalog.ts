import {
  TransactionalTopics,
  TRANSACTIONAL_EVENT_SCHEMA_VERSION,
  type AuditLogRecordedEvent,
} from "@apgms/shared/messaging/transactional-events.js";

export type AuditEventDefinition = {
  topic: string;
  description: string;
  schema: string;
  example: AuditLogRecordedEvent;
};

export const AUDIT_EVENT_DEFINITIONS: AuditEventDefinition[] = [
  {
    topic: TransactionalTopics.audit.recorded,
    description:
      "Authoritative audit trail entry captured once a regulated action completes.",
    schema: "AuditLogRecordedEvent",
    example: {
      eventId: "00000000-0000-4000-8000-000000000100",
      occurredAt: "2024-11-01T01:15:30.000Z",
      schemaVersion: TRANSACTIONAL_EVENT_SCHEMA_VERSION,
      source: "audit.service",
      auditId: "audit_01HTXE5DT3QWZ",
      orgId: "org_demo_a",
      actorId: "user_02XJ9",
      action: "designatedAccount.credit",
      metadata: {
        accountId: "acct_paygw_primary",
        amount: 1520.4,
        transferId: "transfer_01HTXE6JQG2F8",
      },
    } as AuditLogRecordedEvent,
  },
];

export type AuditEventTopic =
  (typeof AUDIT_EVENT_DEFINITIONS)[number]["topic"];
