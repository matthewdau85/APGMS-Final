import { recordAuditLog } from "./audit.js";

export type DecisionStatus = "pending" | "feedback_provided" | "overridden" | "escalated";

export interface DecisionRecord {
  readonly id: string;
  readonly orgId: string;
  readonly model: string;
  readonly riskScore: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly status: DecisionStatus;
  readonly metadata: Record<string, unknown>;
  readonly history: DecisionHistoryEntry[];
}

export interface DecisionHistoryEntry {
  readonly timestamp: Date;
  readonly actorId: string;
  readonly action: string;
  readonly note?: string;
}

export interface DecisionInput {
  readonly id: string;
  readonly orgId: string;
  readonly model: string;
  readonly riskScore: number;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt?: Date;
}

export interface FeedbackInput {
  readonly decisionId: string;
  readonly orgId: string;
  readonly actorId: string;
  readonly outcome: "confirmed" | "false_positive" | "escalate";
  readonly note?: string;
}

export interface OverrideInput {
  readonly decisionId: string;
  readonly orgId: string;
  readonly actorId: string;
  readonly resolution: "approve" | "deny";
  readonly note?: string;
}

type AuditLogger = typeof recordAuditLog;

class HighRiskDecisionStore {
  private readonly decisions = new Map<string, DecisionRecord>();

  constructor(private readonly auditLogger: AuditLogger = recordAuditLog) {}

  listPending(orgId: string): DecisionRecord[] {
    return Array.from(this.decisions.values()).filter(
      (decision) => decision.orgId === orgId && decision.status !== "overridden",
    );
  }

  get(decisionId: string): DecisionRecord | undefined {
    return this.decisions.get(decisionId);
  }

  async registerDecision(input: DecisionInput): Promise<DecisionRecord> {
    const now = input.createdAt ?? new Date();
    const record: DecisionRecord = {
      id: input.id,
      orgId: input.orgId,
      model: input.model,
      riskScore: input.riskScore,
      createdAt: now,
      updatedAt: now,
      status: "pending",
      metadata: { ...(input.metadata ?? {}) },
      history: [
        {
          timestamp: now,
          actorId: "model",
          action: "model.flagged",
        },
      ],
    };

    this.decisions.set(input.id, record);
    return record;
  }

  async addFeedback(input: FeedbackInput): Promise<DecisionRecord> {
    const existing = this.decisions.get(input.decisionId);
    if (!existing || existing.orgId !== input.orgId) {
      throw new Error("decision_not_found");
    }

    const timestamp = new Date();
    const status: DecisionStatus =
      input.outcome === "escalate" ? "escalated" : "feedback_provided";

    const updated: DecisionRecord = {
      ...existing,
      status,
      updatedAt: timestamp,
      history: [
        ...existing.history,
        {
          timestamp,
          actorId: input.actorId,
          action: `human.feedback.${input.outcome}`,
          note: input.note,
        },
      ],
    };

    this.decisions.set(existing.id, updated);

    await this.auditLogger({
      orgId: input.orgId,
      actorId: input.actorId,
      action: "ml.decision.feedback",
      metadata: {
        decisionId: input.decisionId,
        outcome: input.outcome,
        note: input.note ?? null,
      },
    });

    return updated;
  }

  async overrideDecision(input: OverrideInput): Promise<DecisionRecord> {
    const existing = this.decisions.get(input.decisionId);
    if (!existing || existing.orgId !== input.orgId) {
      throw new Error("decision_not_found");
    }

    const timestamp = new Date();
    const updated: DecisionRecord = {
      ...existing,
      status: "overridden",
      updatedAt: timestamp,
      history: [
        ...existing.history,
        {
          timestamp,
          actorId: input.actorId,
          action: `human.override.${input.resolution}`,
          note: input.note,
        },
      ],
    };

    this.decisions.set(existing.id, updated);

    await this.auditLogger({
      orgId: input.orgId,
      actorId: input.actorId,
      action: "ml.decision.override",
      metadata: {
        decisionId: input.decisionId,
        resolution: input.resolution,
        note: input.note ?? null,
      },
    });

    return updated;
  }
}

export const highRiskDecisionStore = new HighRiskDecisionStore();
export type HighRiskDecisionStoreType = HighRiskDecisionStore;

export function createDecisionStoreForTesting(
  auditLogger: AuditLogger,
): HighRiskDecisionStore {
  return new HighRiskDecisionStore(auditLogger);
}
