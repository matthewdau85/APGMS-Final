import {
  TransactionalTopics,
  TRANSACTIONAL_EVENT_SCHEMA_VERSION,
  type ReconciliationGeneratedEvent,
} from "@apgms/shared/messaging/transactional-events.js";

export type ReconEventDefinition = {
  topic: string;
  description: string;
  schema: string;
  example: ReconciliationGeneratedEvent;
};

export const RECON_EVENT_DEFINITIONS: ReconEventDefinition[] = [
  {
    topic: TransactionalTopics.reconciliation.designatedGenerated,
    description:
      "Nightly summary of designated accounts produced for regulator oversight.",
    schema: "ReconciliationGeneratedEvent",
    example: {
      eventId: "00000000-0000-4000-8000-000000000010",
      occurredAt: "2024-11-01T08:05:00.000Z",
      schemaVersion: TRANSACTIONAL_EVENT_SCHEMA_VERSION,
      source: "worker.designated-reconciliation",
      orgId: "org_demo_a",
      artifactId: "art_01HTXJ9R7ZP0A",
      sha256: "b7f46bf4a0d2c4a29d8f5084c35f21e4a0e2e0d1f989c8e0c7b6e0e58c4a8f7a",
      summary: {
        generatedAt: "2024-11-01T08:00:00.000Z",
        totals: {
          paygw: 412000.12,
          gst: 298500.05,
        },
        movementsLast24h: [
          {
            accountId: "acct_paygw_primary",
            type: "PAYGW",
            balance: 275000.12,
            inflow24h: 15000.0,
            transferCount24h: 12,
          },
          {
            accountId: "acct_gst_primary",
            type: "GST",
            balance: 298500.05,
            inflow24h: 22000.5,
            transferCount24h: 18,
          },
        ],
      },
    } as ReconciliationGeneratedEvent,
  },
];

export type ReconEventTopic =
  (typeof RECON_EVENT_DEFINITIONS)[number]["topic"];
