import type { PrismaClient } from "@prisma/client";

export type PosProviderId = "mock" | string;

export type PosProviderContext = {
  prisma: PrismaClient;
  orgId: string;
  actorId: string;
  auditLogger?: AuditLogger;
};

export type AuditLogger = (entry: {
  orgId: string;
  actorId: string;
  action: string;
  metadata: Record<string, unknown>;
}) => Promise<void>;

export type NormalizedPosEvent = {
  eventRef: string;
  occurredAt: Date;
  taxableSales: number;
  gstCollected: number;
  inputTaxCredits: number;
  netGstOwed: number;
  source: string;
  metadata?: Record<string, unknown>;
};

export type IngestPosResult = {
  inserted: number;
  updated: number;
  events: number;
  totals: {
    netGst: number;
    taxableSales: number;
  };
};

export interface PosProvider {
  readonly id: PosProviderId;
  ingestGstEvents(
    context: PosProviderContext,
    payload: unknown,
  ): Promise<IngestPosResult>;
}
