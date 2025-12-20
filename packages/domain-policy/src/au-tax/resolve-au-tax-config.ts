import type { PrismaClient } from "@prisma/client";
import type { JurisdictionCode } from "../tax-types.js";
import { TaxType, type PaygwConfig, type GstConfig } from "./types.js";

/**
 * Resolve AU tax configuration for a given tax type + date.
 *
 * Mechanical goals:
 * - No imports of missing types.
 * - No implicit any under strict mode.
 * - PAYGW brackets must match engine shape (baseCents, rate).
 * - Do not attach unknown properties (e.g. meta) unless types permit.
 */

type AuTaxRateTableRow = {
  kind: string;
  payload: unknown;
  payloadHash?: string | null;
  name?: string | null;
};

type AuTaxParameterSetRow = {
  id: string;
  taxType: string;
  status: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  sourceName?: string | null;
  sourceRef?: string | null;
  sourceHash?: string | null;
  retrievedAt?: Date | null;
  tables: AuTaxRateTableRow[];
};

export async function resolveAuTaxConfig(
  prisma: PrismaClient,
  params: {
    jurisdiction: JurisdictionCode;
    taxType: TaxType.PAYGW | TaxType.GST;
    onDate: Date;
  },
): Promise<PaygwConfig | GstConfig> {
  const { jurisdiction, taxType, onDate } = params;

  const set = (await prisma.auTaxParameterSet.findFirst({
    where: {
      taxType: taxType as any,
      status: "ACTIVE",
      effectiveFrom: { lte: onDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: onDate } }],
    },
    include: { tables: true },
    orderBy: { effectiveFrom: "desc" },
  })) as unknown as AuTaxParameterSetRow | null;

  if (!set || set.status !== "ACTIVE") {
    throw new Error(`TAX_CONFIG_MISSING: No ACTIVE ${taxType} config`);
  }
  const activeSet = set;

  function getTable(kind: string): AuTaxRateTableRow {
    const t = activeSet.tables?.find((x) => x.kind === kind);
    if (!t) {
      throw new Error(`TAX_CONFIG_MISSING: No ${kind} table for ${taxType}`);
    }
    return t;
  }

  if (taxType === TaxType.PAYGW) {
    const table = getTable("PAYGW_WITHHOLDING");

    const payload = (table.payload ?? {}) as Record<string, unknown> | unknown[];
    const bracketSource = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as Record<string, unknown>).brackets)
        ? ((payload as Record<string, unknown>).brackets as unknown[])
        : [];
    const rawBrackets: Array<Record<string, unknown>> = bracketSource.filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === "object" && entry !== null,
    );

    const brackets = rawBrackets.map((b) => ({
      thresholdCents: Number((b as any).thresholdCents ?? (b as any).threshold ?? 0),
      baseCents: Number(
        (b as any).baseCents ?? (b as any).baseWithholdingCents ?? (b as any).base ?? 0,
      ),
      rate: Number((b as any).rate ?? (b as any).marginalRateMilli ?? (b as any).rateMilli ?? 0),
    }));

    const config: PaygwConfig = {
      kind: "PAYGW",
      jurisdiction,
      taxType: TaxType.PAYGW,
      brackets,
    };

    return config;
  }

  // GST
  const gstTable = getTable("GST_RATES");
  const gstPayload = (gstTable.payload ?? {}) as Record<string, unknown>;
  const rateMilli = Number((gstPayload as any).rateMilli ?? (gstPayload as any).rate ?? 100);

  const gstConfig: GstConfig = {
    kind: "GST",
    jurisdiction,
    taxType: TaxType.GST,
    rateMilli,
  };

  return gstConfig;
}
