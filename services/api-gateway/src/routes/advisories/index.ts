import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { AdvisoryAuditLogger } from "@apgms/audit-logger";

import { recordAuditLog } from "../../lib/audit.js";
import { assertOrgAccess, assertRoleForBankLines } from "../../utils/orgScope.js";
import { requireLedgerUser } from "../ledger-guard.js";

const CONTROL_STATUS = ["active", "waived", "mitigated", "in_review"] as const;

type ControlStatus = (typeof CONTROL_STATUS)[number];

type AdvisoryLineItem = {
  id: string;
  controlId: string;
  description: string;
  risk: string;
};

type AdvisoryControl = {
  id: string;
  name: string;
  status: ControlStatus;
  updatedAt: string;
  updatedBy: string;
  justification?: string;
};

type AdvisoryRecord = {
  id: string;
  orgId: string;
  title: string;
  summary: string;
  severity: "low" | "medium" | "high";
  category: string;
  lastReviewedAt: string;
  tags: string[];
  controls: AdvisoryControl[];
  lineItems: AdvisoryLineItem[];
};

const ADVISORIES: AdvisoryRecord[] = [
  {
    id: "adv-ledger-001",
    orgId: "org-ledger",
    title: "Ledger drift in payroll batch 42",
    summary:
      "Automated control flagged a variance between ledger postings and payroll provider totals during batch 42 processing.",
    severity: "high",
    category: "ledger_reconciliation",
    lastReviewedAt: "2025-02-11T04:15:00.000Z",
    tags: ["ledger", "payroll", "controls"],
    controls: [
      {
        id: "ctrl-ledger-approval",
        name: "Dual approval for reversals",
        status: "active",
        updatedAt: "2025-01-12T08:30:00.000Z",
        updatedBy: "user-finance-001",
      },
      {
        id: "ctrl-ledger-monitoring",
        name: "Automated ledger drift monitoring",
        status: "mitigated",
        updatedAt: "2025-02-11T02:55:00.000Z",
        updatedBy: "user-ops-014",
        justification: "Alert acknowledged and mitigation steps applied",
      },
    ],
    lineItems: [
      {
        id: "itm-ledger-001",
        controlId: "ctrl-ledger-monitoring",
        description: "Variance exceeded $10k threshold for payroll batch 42",
        risk: "High variance may indicate reconciliation failure",
      },
      {
        id: "itm-ledger-002",
        controlId: "ctrl-ledger-approval",
        description: "Manual reversal performed without second approval",
        risk: "Increases likelihood of fraudulent ledger updates",
      },
    ],
  },
  {
    id: "adv-ledger-002",
    orgId: "org-ledger",
    title: "Stale control evidence",
    summary:
      "Quarterly evidence for ledger control LC-17 is overdue and requires review to maintain assurance.",
    severity: "medium",
    category: "control_assurance",
    lastReviewedAt: "2025-01-04T12:00:00.000Z",
    tags: ["assurance", "evidence"],
    controls: [
      {
        id: "ctrl-evidence-refresh",
        name: "Quarterly evidence refresh",
        status: "in_review",
        updatedAt: "2025-01-04T12:00:00.000Z",
        updatedBy: "user-compliance-002",
      },
    ],
    lineItems: [
      {
        id: "itm-ledger-101",
        controlId: "ctrl-evidence-refresh",
        description: "Evidence package older than 120 days",
        risk: "Audit finding risk due to stale evidence",
      },
    ],
  },
  {
    id: "adv-ledger-003",
    orgId: "org-analytics",
    title: "Analytics export permissions",
    summary: "Analytics service retains export role for deprecated ledger dataset.",
    severity: "low",
    category: "access_management",
    lastReviewedAt: "2024-12-17T09:00:00.000Z",
    tags: ["access", "legacy"],
    controls: [
      {
        id: "ctrl-access-review",
        name: "Monthly access review",
        status: "active",
        updatedAt: "2024-12-17T09:00:00.000Z",
        updatedBy: "user-analytics-008",
      },
    ],
    lineItems: [
      {
        id: "itm-ledger-205",
        controlId: "ctrl-access-review",
        description: "Deprecated dataset still accessible by analytics export role",
        risk: "Potential data leakage of sensitive ledger exports",
      },
    ],
  },
];

const ExportRequestSchema = z.object({
  includeLineItems: z.boolean().optional(),
  format: z.enum(["json", "csv", "pdf"]).default("json"),
});

const ControlUpdateSchema = z.object({
  status: z.enum(CONTROL_STATUS),
  justification: z.string().min(1).optional(),
});

function buildAuditLogger(): AdvisoryAuditLogger {
  return new AdvisoryAuditLogger(async (event) => {
    await recordAuditLog({
      orgId: event.orgId,
      actorId: event.actorId,
      action: event.action,
      metadata: {
        ...event.metadata,
        occurredAt: event.timestamp.toISOString(),
      },
      throwOnError: true,
    });
  });
}

function ensureLedgerAuthorised(
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string
): boolean {
  if (!assertOrgAccess(request, reply, orgId)) return false;
  if (!assertRoleForBankLines(request, reply)) return false;
  return true;
}

function toSummary(advisory: AdvisoryRecord) {
  const activeControls = advisory.controls.filter((control) => control.status === "active").length;
  return {
    id: advisory.id,
    title: advisory.title,
    summary: advisory.summary,
    severity: advisory.severity,
    lastReviewedAt: advisory.lastReviewedAt,
    tags: advisory.tags,
    controls: {
      total: advisory.controls.length,
      active: activeControls,
    },
  };
}

function serialiseAdvisory(advisory: AdvisoryRecord) {
  return {
    id: advisory.id,
    orgId: advisory.orgId,
    title: advisory.title,
    summary: advisory.summary,
    severity: advisory.severity,
    category: advisory.category,
    lastReviewedAt: advisory.lastReviewedAt,
    tags: advisory.tags,
    controls: advisory.controls,
    lineItems: advisory.lineItems,
  };
}

function findAdvisory(orgId: string, advisoryId: string): AdvisoryRecord | undefined {
  return ADVISORIES.find((item) => item.orgId === orgId && item.id === advisoryId);
}

export const registerAdvisoryRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const auditLogger = buildAuditLogger();

  app.get("/advisories", async (request, reply) => {
    const user = requireLedgerUser(request, reply);
    if (!user) return;

    if (!ensureLedgerAuthorised(request, reply, user.orgId)) return;

    const scoped = ADVISORIES.filter((entry) => entry.orgId === user.orgId);

    await auditLogger.logView({
      orgId: user.orgId,
      actorId: user.sub,
      advisoryIds: scoped.map((entry) => entry.id),
      scope: "list",
      resultCount: scoped.length,
      filters: null,
    });

    reply.send({
      items: scoped.map(toSummary),
    });
  });

  app.get("/advisories/:id", async (request, reply) => {
    const user = requireLedgerUser(request, reply);
    if (!user) return;

    if (!ensureLedgerAuthorised(request, reply, user.orgId)) return;

    const advisoryId = String((request.params as Record<string, string | undefined>).id ?? "");
    const advisory = findAdvisory(user.orgId, advisoryId);

    if (!advisory) {
      reply.code(404).send({
        error: {
          code: "advisory_not_found",
          message: "Advisory not found",
        },
      });
      return;
    }

    await auditLogger.logView({
      orgId: user.orgId,
      actorId: user.sub,
      advisoryIds: [advisory.id],
      scope: "detail",
      resultCount: 1,
      filters: null,
    });

    reply.send({ advisory: serialiseAdvisory(advisory) });
  });

  app.post("/advisories/:id/export", async (request, reply) => {
    const user = requireLedgerUser(request, reply);
    if (!user) return;

    if (!ensureLedgerAuthorised(request, reply, user.orgId)) return;

    const advisoryId = String((request.params as Record<string, string | undefined>).id ?? "");
    const advisory = findAdvisory(user.orgId, advisoryId);

    if (!advisory) {
      reply.code(404).send({
        error: {
          code: "advisory_not_found",
          message: "Advisory not found",
        },
      });
      return;
    }

    const payload = ExportRequestSchema.parse(request.body ?? {});

    const exportId = randomUUID();
    const response = {
      exportId,
      format: payload.format,
      advisory: {
        ...serialiseAdvisory(advisory),
        lineItems: payload.includeLineItems ? advisory.lineItems : undefined,
      },
      generatedAt: new Date().toISOString(),
    };

    await auditLogger.logExport({
      orgId: user.orgId,
      actorId: user.sub,
      advisoryId: advisory.id,
      exportId,
      format: payload.format,
      includeLineItems: Boolean(payload.includeLineItems),
      itemCount: advisory.lineItems.length,
      reason: null,
    });

    reply.send(response);
  });

  app.patch("/advisories/:id/controls/:controlId", async (request, reply) => {
    const user = requireLedgerUser(request, reply);
    if (!user) return;

    if (!ensureLedgerAuthorised(request, reply, user.orgId)) return;

    const params = request.params as { id?: string; controlId?: string };
    const advisoryId = String(params.id ?? "");
    const controlId = String(params.controlId ?? "");

    const advisory = findAdvisory(user.orgId, advisoryId);
    if (!advisory) {
      reply.code(404).send({
        error: {
          code: "advisory_not_found",
          message: "Advisory not found",
        },
      });
      return;
    }

    const control = advisory.controls.find((entry) => entry.id === controlId);
    if (!control) {
      reply.code(404).send({
        error: {
          code: "control_not_found",
          message: "Control not found",
        },
      });
      return;
    }

    const payload = ControlUpdateSchema.parse(request.body ?? {});
    const previousStatus = control.status;

    control.status = payload.status;
    control.updatedAt = new Date().toISOString();
    control.updatedBy = user.sub;
    control.justification = payload.justification ?? control.justification;

    await auditLogger.logControlChange({
      orgId: user.orgId,
      actorId: user.sub,
      advisoryId: advisory.id,
      controlId: control.id,
      previousStatus,
      nextStatus: control.status,
      justification: payload.justification ?? null,
    });

    reply.send({
      control,
      advisoryId: advisory.id,
    });
  });
};

export default registerAdvisoryRoutes;
