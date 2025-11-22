// shared/src/types/domain-policy-shim.d.ts

declare module "@apgms/domain-policy" {
  import type { PrismaClient } from "@prisma/client";

  export interface AuditLoggerEntry {
    orgId: string;
    actorId?: string;
    event: string;
    details?: unknown;
    createdAt?: Date;
  }

  export interface AuditLogger {
    log(entry: AuditLoggerEntry): void | Promise<void>;
  }

  export interface DesignatedAccountTransferParams {
    orgId: string;
    accountId: string;
    amount: number;
    source: string;
    actorId: string;
  }

  export interface DesignatedAccountTransferResult {
    transferId: string;
  }

  export interface DomainPolicyContext {
    prisma: PrismaClient;
    auditLogger?: AuditLogger;
  }

  export function applyDesignatedAccountTransfer(
    ctx: DomainPolicyContext,
    params: DesignatedAccountTransferParams,
  ): Promise<DesignatedAccountTransferResult>;
}
