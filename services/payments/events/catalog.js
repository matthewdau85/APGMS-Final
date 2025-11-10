import {
  TransactionalTopics,
  TRANSACTIONAL_EVENT_SCHEMA_VERSION,
} from "@apgms/shared/messaging/transactional-events.js";

export const PAYMENT_EVENT_DEFINITIONS = [
  {
    topic: TransactionalTopics.payments.initiated,
    description:
      "Payment instruction accepted and persisted, awaiting onward clearing.",
    schema: "PaymentInitiatedEvent",
    example: {
      eventId: "00000000-0000-4000-8000-000000000001",
      occurredAt: "2024-11-01T02:00:00.000Z",
      schemaVersion: TRANSACTIONAL_EVENT_SCHEMA_VERSION,
      source: "payments.api",
      paymentId: "pay_01HTXF6Z9G7A2",
      orgId: "org_demo_a",
      currency: "AUD",
      amount: 1520.4,
      method: "BANK_TRANSFER",
      counterparty: {
        name: "Australian Taxation Office",
        accountId: "ATO-BAS",
      },
      reference: "BAS NOVEMBER",
    },
  },
  {
    topic: TransactionalTopics.payments.settled,
    description:
      "Clearing confirmation received for an initiated payment instruction.",
    schema: "PaymentSettledEvent",
    example: {
      eventId: "00000000-0000-4000-8000-000000000002",
      occurredAt: "2024-11-01T05:30:00.000Z",
      schemaVersion: TRANSACTIONAL_EVENT_SCHEMA_VERSION,
      source: "payments.settlement-reporter",
      paymentId: "pay_01HTXF6Z9G7A2",
      orgId: "org_demo_a",
      currency: "AUD",
      amount: 1520.4,
      settledAt: "2024-11-01T05:29:12.000Z",
      settlementReference: "NPP-20241101-00001",
    },
  },
  {
    topic: TransactionalTopics.payments.failed,
    description:
      "Payment instruction rejected downstream; operations required to retry or notify customer.",
    schema: "PaymentFailedEvent",
    example: {
      eventId: "00000000-0000-4000-8000-000000000003",
      occurredAt: "2024-11-01T03:10:45.000Z",
      schemaVersion: TRANSACTIONAL_EVENT_SCHEMA_VERSION,
      source: "payments.settlement-reporter",
      paymentId: "pay_01HTXFA68GRQ8",
      orgId: "org_demo_b",
      currency: "AUD",
      amount: 880.0,
      failureCode: "BANK_ACCOUNT_CLOSED",
      failureReason: "Destination account returned closed by receiving bank",
    },
  },
];
