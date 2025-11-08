import type { PrismaClient } from "@prisma/client";

export type StpProviderId = "mock" | string;

export type StpProviderContext = {
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

export type NormalizedStpSummary = {
  providerRunId: string;
  periodStart: Date;
  periodEnd: Date;
  paymentDate: Date;
  grossWages: number;
  paygwWithheld: number;
  superAccrued: number;
  employeeCount: number;
  source: string;
  metadata?: Record<string, unknown>;
};

export type IngestStpResult = {
  inserted: number;
  updated: number;
  totals: {
    paygw: number;
    gross: number;
  };
  runs: number;
};

export interface StpProvider {
  readonly id: StpProviderId;
  ingestPayrollSummaries(
    context: StpProviderContext,
    payload: unknown,
  ): Promise<IngestStpResult>;
}
