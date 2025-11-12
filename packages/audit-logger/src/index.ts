export type AdvisoryAuditAction =
  | "advisory.view"
  | "advisory.export"
  | "advisory.control_change";

export interface AdvisoryAuditEvent<Action extends AdvisoryAuditAction = AdvisoryAuditAction> {
  action: Action;
  orgId: string;
  actorId: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export type AuditEventSink = (event: AdvisoryAuditEvent) => Promise<void> | void;

export interface AdvisoryViewEventInput {
  orgId: string;
  actorId: string;
  advisoryIds: readonly string[];
  scope: "list" | "detail";
  filters?: Record<string, unknown> | null;
  resultCount: number;
  occurredAt?: Date;
}

export interface AdvisoryExportEventInput {
  orgId: string;
  actorId: string;
  advisoryId: string;
  exportId: string;
  format: string;
  itemCount: number;
  includeLineItems?: boolean;
  reason?: string | null;
  occurredAt?: Date;
}

export interface AdvisoryControlChangeInput {
  orgId: string;
  actorId: string;
  advisoryId: string;
  controlId: string;
  previousStatus: string;
  nextStatus: string;
  justification?: string | null;
  occurredAt?: Date;
}

export class AdvisoryAuditLogger {
  constructor(private readonly sink: AuditEventSink) {
    if (typeof sink !== "function") {
      throw new TypeError("AdvisoryAuditLogger requires a sink function");
    }
  }

  async logView(input: AdvisoryViewEventInput): Promise<void> {
    const metadata = cleanMetadata({
      advisoryIds: [...input.advisoryIds],
      scope: input.scope,
      filters: input.filters ?? null,
      resultCount: input.resultCount,
    });

    await this.emit({
      action: "advisory.view",
      orgId: input.orgId,
      actorId: input.actorId,
      timestamp: input.occurredAt ?? new Date(),
      metadata,
    });
  }

  async logExport(input: AdvisoryExportEventInput): Promise<void> {
    const metadata = cleanMetadata({
      advisoryId: input.advisoryId,
      exportId: input.exportId,
      format: input.format,
      itemCount: input.itemCount,
      includeLineItems: Boolean(input.includeLineItems),
      reason: input.reason ?? null,
    });

    await this.emit({
      action: "advisory.export",
      orgId: input.orgId,
      actorId: input.actorId,
      timestamp: input.occurredAt ?? new Date(),
      metadata,
    });
  }

  async logControlChange(input: AdvisoryControlChangeInput): Promise<void> {
    const metadata = cleanMetadata({
      advisoryId: input.advisoryId,
      controlId: input.controlId,
      previousStatus: input.previousStatus,
      nextStatus: input.nextStatus,
      justification: input.justification ?? null,
    });

    await this.emit({
      action: "advisory.control_change",
      orgId: input.orgId,
      actorId: input.actorId,
      timestamp: input.occurredAt ?? new Date(),
      metadata,
    });
  }

  private async emit(event: AdvisoryAuditEvent): Promise<void> {
    await this.sink({
      action: event.action,
      orgId: event.orgId,
      actorId: event.actorId,
      timestamp: event.timestamp,
      metadata: event.metadata,
    });
  }
}

function cleanMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  );
}
