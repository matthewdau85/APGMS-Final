import { createHash } from "node:crypto";

import { Prisma, type PrismaClient, type BasCycle } from "@prisma/client";

import { AppError } from "@apgms/shared";

const EPSILON = Number(process.env.APGMS_BAS_VERIFIER_EPSILON ?? "0.5");

export type BasVerifierContext = {
  prisma: PrismaClient;
  auditLogger?: AuditLogger;
};

export type BasVerificationInput = {
  orgId: string;
  basCycleId: string;
  actorId: string;
};

export type BasDiscrepancy = {
  tax: "PAYGW" | "GST";
  expected: number;
  designated: number;
  delta: number;
  guidance: string;
};

export type BasVerificationResult = {
  cycle: BasCycle;
  expected: { paygw: number; gst: number };
  designated: { paygw: number; gst: number };
  discrepancies: BasDiscrepancy[];
  artifact: BasDiscrepancyArtifact | null;
};

export type BasDiscrepancyArtifact = {
  id: string;
  sha256: string;
  generatedAt: string;
  jsonHash?: string;
};

type AuditLogger = (entry: {
  orgId: string;
  actorId: string;
  action: string;
  metadata: Record<string, unknown>;
}) => Promise<void>;

type RawDiscrepancyReport = {
  version: string;
  generatedAt: string;
  basCycle: {
    id: string;
    periodStart: string;
    periodEnd: string;
  };
  actorId: string;
  expected: { paygw: number; gst: number };
  designated: { paygw: number; gst: number };
  discrepancies: BasDiscrepancy[];
  remediation: string[];
  jsonHash?: string;
  pdfBase64?: string;
};

export async function verifyBasDesignatedBalance(
  context: BasVerifierContext,
  input: BasVerificationInput,
): Promise<BasVerificationResult> {
  const cycle = await context.prisma.basCycle.findUnique({
    where: { id: input.basCycleId },
  });

  if (!cycle || cycle.orgId !== input.orgId) {
    throw new AppError(404, "bas_cycle_not_found", "BAS cycle not found for organisation");
  }

  const expected = await computeExpectedAmounts(context.prisma, cycle);

  const updatedCycle = await context.prisma.basCycle.update({
    where: { id: cycle.id },
    data: {
      paygwRequired: new Prisma.Decimal(expected.paygw),
      gstRequired: new Prisma.Decimal(expected.gst),
    },
  });

  const designated = await loadDesignatedTotals(context.prisma, input.orgId);

  const discrepancies = buildDiscrepancies(expected, designated);

  let artifact: BasDiscrepancyArtifact | null = null;
  if (discrepancies.length > 0) {
    await ensureDiscrepancyAlert(context.prisma, input.orgId, discrepancies);
    artifact = await createDiscrepancyArtifact(context.prisma, {
      orgId: input.orgId,
      actorId: input.actorId,
      cycle: updatedCycle,
      expected,
      designated,
      discrepancies,
    });
    if (context.auditLogger) {
      await context.auditLogger({
        orgId: input.orgId,
        actorId: input.actorId,
        action: "bas.verifier.blocked",
        metadata: {
          basCycleId: updatedCycle.id,
          discrepancies: discrepancies.map((entry) => ({
            tax: entry.tax,
            delta: entry.delta,
          })),
          artifactId: artifact?.id,
        },
      });
    }
  } else {
    await resolveDiscrepancyAlerts(context.prisma, input.orgId);
    if (context.auditLogger) {
      await context.auditLogger({
        orgId: input.orgId,
        actorId: input.actorId,
        action: "bas.verifier.passed",
        metadata: {
          basCycleId: updatedCycle.id,
          expected,
          designated,
        },
      });
    }
  }

  return {
    cycle: updatedCycle,
    expected,
    designated,
    discrepancies,
    artifact,
  };
}

export async function fetchLatestBasDiscrepancyReport(
  prisma: PrismaClient,
  orgId: string,
): Promise<(BasDiscrepancyArtifact & { payload: RawDiscrepancyReport }) | null> {
  const artifact = await prisma.evidenceArtifact.findFirst({
    where: { orgId, kind: "bas.discrepancy" },
    orderBy: { createdAt: "desc" },
  });

  if (!artifact) {
    return null;
  }

  const payload = normalizeArtifactPayload(artifact.payload);

  return {
    id: artifact.id,
    sha256: artifact.sha256,
    generatedAt: payload.generatedAt ?? artifact.createdAt.toISOString(),
    jsonHash: payload.jsonHash,
    payload,
  };
}

function normalizeArtifactPayload(value: unknown): RawDiscrepancyReport {
  if (!value || typeof value !== "object") {
    throw new AppError(500, "bas_discrepancy_payload_invalid", "BAS discrepancy artifact payload malformed");
  }
  const payload = value as Partial<RawDiscrepancyReport>;
  if (!payload.basCycle || !payload.generatedAt || !payload.expected || !payload.designated) {
    throw new AppError(500, "bas_discrepancy_payload_invalid", "BAS discrepancy artifact payload incomplete");
  }
  return payload as RawDiscrepancyReport;
}

async function computeExpectedAmounts(prisma: PrismaClient, cycle: BasCycle) {
  const stpAggregate = await prisma.stpPayrollSummary.aggregate({
    where: {
      orgId: cycle.orgId,
      paymentDate: {
        gte: cycle.periodStart,
        lte: cycle.periodEnd,
      },
    },
    _sum: {
      paygwWithheld: true,
    },
  });

  const gstAggregate = await prisma.posGstEvent.aggregate({
    where: {
      orgId: cycle.orgId,
      occurredAt: {
        gte: cycle.periodStart,
        lte: cycle.periodEnd,
      },
    },
    _sum: {
      netGstOwed: true,
    },
  });

  return {
    paygw: decimalToNumber(stpAggregate._sum.paygwWithheld),
    gst: decimalToNumber(gstAggregate._sum.netGstOwed),
  };
}

async function loadDesignatedTotals(prisma: PrismaClient, orgId: string) {
  const accounts = await prisma.designatedAccount.findMany({
    where: { orgId },
  });

  let paygw = 0;
  let gst = 0;
  for (const account of accounts) {
    if (account.type.toUpperCase() === "PAYGW") {
      paygw += decimalToNumber(account.balance);
    } else if (account.type.toUpperCase() === "GST") {
      gst += decimalToNumber(account.balance);
    }
  }

  return { paygw, gst };
}

function buildDiscrepancies(
  expected: { paygw: number; gst: number },
  designated: { paygw: number; gst: number },
): BasDiscrepancy[] {
  const discrepancies: BasDiscrepancy[] = [];

  const paygwDelta = designated.paygw - expected.paygw;
  if (Math.abs(paygwDelta) > EPSILON) {
    discrepancies.push({
      tax: "PAYGW",
      expected: roundCurrency(expected.paygw),
      designated: roundCurrency(designated.paygw),
      delta: roundCurrency(paygwDelta),
      guidance:
        paygwDelta < 0
          ? "Fund the PAYGW designated account to match withheld amounts reported via STP."
          : "Reconcile excess PAYGW deposits before lodging to avoid overstated liabilities.",
    });
  }

  const gstDelta = designated.gst - expected.gst;
  if (Math.abs(gstDelta) > EPSILON) {
    discrepancies.push({
      tax: "GST",
      expected: roundCurrency(expected.gst),
      designated: roundCurrency(designated.gst),
      delta: roundCurrency(gstDelta),
      guidance:
        gstDelta < 0
          ? "Top up the GST holding account to cover net GST owed for the period."
          : "Investigate GST capture over-funding and adjust before remittance.",
    });
  }

  return discrepancies;
}

async function ensureDiscrepancyAlert(
  prisma: PrismaClient,
  orgId: string,
  discrepancies: BasDiscrepancy[],
) {
  const existing = await prisma.alert.findFirst({
    where: {
      orgId,
      type: "BAS_DESIGNATED_MISMATCH",
      resolvedAt: null,
    },
  });

  const message = buildAlertMessage(discrepancies);

  if (existing) {
    await prisma.alert.update({
      where: { id: existing.id },
      data: { message },
    });
    return;
  }

  await prisma.alert.create({
    data: {
      orgId,
      type: "BAS_DESIGNATED_MISMATCH",
      severity: "HIGH",
      message,
    },
  });
}

async function resolveDiscrepancyAlerts(prisma: PrismaClient, orgId: string) {
  await prisma.alert.updateMany({
    where: {
      orgId,
      type: "BAS_DESIGNATED_MISMATCH",
      resolvedAt: null,
    },
    data: {
      resolvedAt: new Date(),
      resolutionNote: "Designated balances now match expected PAYGW/GST",
    },
  });
}

async function createDiscrepancyArtifact(
  prisma: PrismaClient,
  input: {
    orgId: string;
    actorId: string;
    cycle: BasCycle;
    expected: { paygw: number; gst: number };
    designated: { paygw: number; gst: number };
    discrepancies: BasDiscrepancy[];
  },
): Promise<BasDiscrepancyArtifact> {
  const remediation = buildRemediation(input.discrepancies);

  const baseReport = {
    version: "1.0",
    basCycle: {
      id: input.cycle.id,
      periodStart: input.cycle.periodStart.toISOString(),
      periodEnd: input.cycle.periodEnd.toISOString(),
    },
    actorId: input.actorId,
    expected: {
      paygw: roundCurrency(input.expected.paygw),
      gst: roundCurrency(input.expected.gst),
    },
    designated: {
      paygw: roundCurrency(input.designated.paygw),
      gst: roundCurrency(input.designated.gst),
    },
    discrepancies: input.discrepancies,
    remediation,
  } satisfies Omit<RawDiscrepancyReport, "generatedAt" | "jsonHash" | "pdfBase64">;

  const dedupeHash = createHash("sha256")
    .update(JSON.stringify(baseReport, null, 2))
    .digest("hex");

  const existingCandidate = await prisma.evidenceArtifact.findFirst({
    where: {
      orgId: input.orgId,
      kind: "bas.discrepancy",
      wormUri: { startsWith: `urn:apgms:bas-discrepancy:${input.cycle.id}:` },
    },
    orderBy: { createdAt: "desc" },
  });

  let existing: (typeof existingCandidate & { payload: RawDiscrepancyReport }) | null = null;
  if (existingCandidate) {
    try {
      const payload = normalizeArtifactPayload(existingCandidate.payload);
      const payloadComparable = buildComparableReport(payload);
      const payloadHash = createHash("sha256")
        .update(JSON.stringify(payloadComparable, null, 2))
        .digest("hex");
      if (payloadHash === dedupeHash) {
        existing = { ...existingCandidate, payload };
      }
    } catch {
      existing = null;
    }
  }

  const generatedAt = existing
    ? existing.payload.generatedAt ?? existing.createdAt.toISOString()
    : new Date().toISOString();

  const report: RawDiscrepancyReport = {
    ...baseReport,
    generatedAt,
  };

  const jsonString = JSON.stringify(report, null, 2);
  const jsonHash = createHash("sha256").update(jsonString).digest("hex");
  report.jsonHash = jsonHash;

  const pdfBytes = renderDiscrepancyPdf(report);
  const pdfHash = createHash("sha256").update(pdfBytes).digest("hex");
  report.pdfBase64 = pdfBytes.toString("base64");

  const wormUri = `urn:apgms:bas-discrepancy:${input.cycle.id}:${dedupeHash}`;

  if (existing) {
    await prisma.evidenceArtifact.update({
      where: { id: existing.id },
      data: { payload: report, sha256: pdfHash, wormUri },
    });
    return {
      id: existing.id,
      sha256: pdfHash,
      generatedAt,
      jsonHash,
    };
  }

  const artifact = await prisma.evidenceArtifact.create({
    data: {
      orgId: input.orgId,
      kind: "bas.discrepancy",
      wormUri,
      sha256: pdfHash,
      payload: report,
    },
  });

  return {
    id: artifact.id,
    sha256: artifact.sha256,
    generatedAt,
    jsonHash,
  };
}

function buildComparableReport(
  report: RawDiscrepancyReport,
): Omit<RawDiscrepancyReport, "generatedAt" | "jsonHash" | "pdfBase64"> {
  return {
    version: report.version,
    basCycle: report.basCycle,
    actorId: report.actorId,
    expected: report.expected,
    designated: report.designated,
    discrepancies: report.discrepancies,
    remediation: report.remediation,
  };
}

function buildRemediation(discrepancies: BasDiscrepancy[]): string[] {
  const steps = new Set<string>();
  for (const discrepancy of discrepancies) {
    if (discrepancy.tax === "PAYGW") {
      steps.add("Investigate recent payroll runs to confirm PAYGW withholding totals.");
      steps.add("Fund or sweep the PAYGW designated account until it matches the withheld amount.");
    }
    if (discrepancy.tax === "GST") {
      steps.add("Reconcile POS GST capture to ensure all taxable sales are represented.");
      steps.add("Adjust GST designated account balances before retrying BAS lodgment.");
    }
  }
  steps.add("Re-run the BAS preview once balances are corrected to release the remittance block.");
  return Array.from(steps);
}

function buildAlertMessage(discrepancies: BasDiscrepancy[]): string {
  const parts = discrepancies.map(
    (entry) =>
      `${entry.tax} designated balance deviates by $${Math.abs(entry.delta).toFixed(2)} (expected $${entry.expected.toFixed(2)}, secured $${entry.designated.toFixed(2)})`,
  );
  return `BAS remittance blocked: ${parts.join("; ")}`;
}

function renderDiscrepancyPdf(report: RawDiscrepancyReport): Buffer {
  const lines: string[] = [];
  lines.push("Australian Payroll Gateway Management System");
  lines.push("BAS Discrepancy Report");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`BAS Cycle: ${report.basCycle.id}`);
  lines.push(`Period: ${report.basCycle.periodStart} – ${report.basCycle.periodEnd}`);
  lines.push("");
  lines.push(`Expected PAYGW: $${report.expected.paygw.toFixed(2)}`);
  lines.push(`Designated PAYGW: $${report.designated.paygw.toFixed(2)}`);
  lines.push(`Expected GST: $${report.expected.gst.toFixed(2)}`);
  lines.push(`Designated GST: $${report.designated.gst.toFixed(2)}`);
  lines.push("");
  if (report.discrepancies.length === 0) {
    lines.push("No discrepancies detected.");
  } else {
    lines.push("Discrepancies:");
    for (const discrepancy of report.discrepancies) {
      lines.push(
        `- ${discrepancy.tax}: delta $${discrepancy.delta.toFixed(2)} – ${discrepancy.guidance}`,
      );
    }
  }
  lines.push("");
  if (report.remediation.length > 0) {
    lines.push("Remediation steps:");
    for (const step of report.remediation) {
      lines.push(`• ${step}`);
    }
  }

  return createSimplePdf(lines);
}

function createSimplePdf(lines: string[]): Buffer {
  const header = "%PDF-1.4\n";
  let body = "";
  const offsets: number[] = [0];

  const addObject = (content: string) => {
    offsets.push(header.length + body.length);
    body += content;
  };

  addObject("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  addObject("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  addObject(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
  );

  const escapedLines = lines.map((line, index) => {
    const escaped = escapePdfText(line);
    return index === 0 ? `(${escaped}) Tj` : `T* (${escaped}) Tj`;
  });

  const textStream = [
    "BT",
    "/F1 12 Tf",
    "1 0 0 1 72 720 Tm",
    "16 TL",
    ...escapedLines,
    "ET",
  ].join("\n");

  addObject(
    `4 0 obj\n<< /Length ${textStream.length} >>\nstream\n${textStream}\nendstream\nendobj\n`,
  );

  addObject(
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  );

  const xrefOffset = header.length + body.length;
  let xref = `xref\n0 ${offsets.length}\n`;
  xref += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    xref += `${offsets[i].toString().padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const pdf = header + body + xref + trailer;
  return Buffer.from(pdf, "utf8");
}

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  return Number(value);
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
