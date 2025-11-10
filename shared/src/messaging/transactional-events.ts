export interface BaseTransactionalEventPayload {
  /**
   * Immutable, globally unique identifier for this event.
   */
  eventId: string;
  /**
   * ISO-8601 timestamp indicating when the source system observed the event.
   */
  occurredAt: string;
  /**
   * Semantic version for the payload schema so downstream systems can
   * negotiate breaking changes.
   */
  schemaVersion: string;
  /**
   * Identifier for the system or component that emitted the event.
   */
  source: string;
}

export interface PaymentInitiatedEvent extends BaseTransactionalEventPayload {
  paymentId: string;
  orgId: string;
  currency: string;
  amount: number;
  method: "BANK_TRANSFER" | "DIRECT_DEBIT" | "CARD" | "OTHER";
  counterparty: {
    name: string;
    accountId: string;
  };
  reference: string;
}

export interface PaymentSettledEvent extends BaseTransactionalEventPayload {
  paymentId: string;
  orgId: string;
  currency: string;
  amount: number;
  settledAt: string;
  settlementReference: string;
}

export interface PaymentFailedEvent extends BaseTransactionalEventPayload {
  paymentId: string;
  orgId: string;
  currency: string;
  amount: number;
  failureCode: string;
  failureReason: string;
}

export interface ReconciliationGeneratedEvent
  extends BaseTransactionalEventPayload {
  orgId: string;
  artifactId: string;
  sha256: string;
  summary: {
    generatedAt: string;
    totals: {
      paygw: number;
      gst: number;
    };
    movementsLast24h: Array<{
      accountId: string;
      type: string;
      balance: number;
      inflow24h: number;
      transferCount24h: number;
    }>;
  };
}

export interface AuditLogRecordedEvent
  extends BaseTransactionalEventPayload {
  auditId: string;
  orgId: string;
  actorId: string;
  action: string;
  metadata: Record<string, unknown>;
}

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
} as const;

export type TransactionalTopicGroup = typeof TransactionalTopics;
export type TransactionalTopicCategories =
  TransactionalTopicGroup[keyof TransactionalTopicGroup];
export type TransactionalTopic =
  TransactionalTopicCategories[keyof TransactionalTopicCategories];

export interface TransactionalEventPayloadMap {
  [TransactionalTopics.payments.initiated]: PaymentInitiatedEvent;
  [TransactionalTopics.payments.settled]: PaymentSettledEvent;
  [TransactionalTopics.payments.failed]: PaymentFailedEvent;
  [TransactionalTopics.reconciliation.designatedGenerated]: ReconciliationGeneratedEvent;
  [TransactionalTopics.audit.recorded]: AuditLogRecordedEvent;
}

export type TransactionalEvent<TTopic extends TransactionalTopic = TransactionalTopic> = {
  topic: TTopic;
  payload: TransactionalEventPayloadMap[TTopic];
};

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireField(value: string, field: string): void {
  if (!value || !value.trim()) {
    throw new Error(`Event payload is missing required field '${field}'`);
  }
}

export function assertBaseEventPayload(
  payload: BaseTransactionalEventPayload,
): void {
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

export const TRANSACTIONAL_EVENT_SCHEMA_VERSION = "2024-11-01";

export const TransactionalEventCatalog = [
  {
    topic: TransactionalTopics.payments.initiated,
    description: "Payment instruction accepted by the payments service and awaiting execution.",
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
    description: "Payment could not be processed and has been marked as failed.",
    schema: "PaymentFailedEvent",
    owners: ["payments"],
  },
  {
    topic: TransactionalTopics.reconciliation.designatedGenerated,
    description: "Nightly designated account reconciliation artefact generated for regulators.",
    schema: "ReconciliationGeneratedEvent",
    owners: ["recon", "worker"],
  },
  {
    topic: TransactionalTopics.audit.recorded,
    description: "Immutable audit trail entry captured for regulated operations.",
    schema: "AuditLogRecordedEvent",
    owners: ["audit"],
  },
] as const;
