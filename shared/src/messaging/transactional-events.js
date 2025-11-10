export const TransactionalTopics = {
  payments: {
    initiated: "payments.transaction.initiated",
    settled: "payments.transaction.settled",
    failed: "payments.transaction.failed",
  },
  reconciliation: {
    designatedGenerated: "recon.designated.reconciliation.generated",
  },
  audit: {
    recorded: "audit.log.recorded",
  },
};

export const TRANSACTIONAL_EVENT_SCHEMA_VERSION = "2024-11-01";

export const TransactionalEventCatalog = [
  {
    topic: TransactionalTopics.payments.initiated,
    description:
      "Payment instruction accepted by the payments service and awaiting execution.",
    schema: "PaymentInitiatedEvent",
    owners: ["payments"],
  },
  {
    topic: TransactionalTopics.payments.settled,
    description: "Payment cleared and funds settled with the counterparty.",
    schema: "PaymentSettledEvent",
    owners: ["payments", "recon"],
  },
  {
    topic: TransactionalTopics.payments.failed,
    description:
      "Payment could not be processed and has been marked as failed.",
    schema: "PaymentFailedEvent",
    owners: ["payments"],
  },
  {
    topic: TransactionalTopics.reconciliation.designatedGenerated,
    description:
      "Nightly designated account reconciliation artefact generated for regulators.",
    schema: "ReconciliationGeneratedEvent",
    owners: ["recon", "worker"],
  },
  {
    topic: TransactionalTopics.audit.recorded,
    description:
      "Immutable audit trail entry captured for regulated operations.",
    schema: "AuditLogRecordedEvent",
    owners: ["audit"],
  },
];

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireField(value, field) {
  if (!value || !value.trim()) {
    throw new Error(`Event payload is missing required field '${field}'`);
  }
}

/**
 * Basic guard to ensure immutable identifiers and timestamps are present on
 * domain events before they are persisted or published.
 *
 * @param {{ eventId: string; occurredAt: string; schemaVersion: string; source: string }} payload
 */
export function assertBaseEventPayload(payload) {
  requireField(payload.eventId, "eventId");
  if (!UUID_V4_REGEX.test(payload.eventId)) {
    throw new Error(
      `Event id '${payload.eventId}' is not a valid RFC 4122 identifier`,
    );
  }

  requireField(payload.occurredAt, "occurredAt");
  if (Number.isNaN(Date.parse(payload.occurredAt))) {
    throw new Error(
      `Event timestamp '${payload.occurredAt}' is not a valid ISO-8601 string`,
    );
  }

  requireField(payload.schemaVersion, "schemaVersion");
  requireField(payload.source, "source");
}
