// packages/domain-policy/src/au-tax/prisma-repository.ts
import type { PrismaClient } from "@prisma/client";
import type { AuTaxConfig, TaxConfigQuery, TaxConfigRepository } from "./types.js";
import { TaxType } from "./types.js";
import { assertAuOnly } from "./assert-au-only.js";

type DbParameterSet = {
  id: string;
  taxType: string;
  status: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  sourceName: string;
  sourceRef: string | null;
  sourceHash: string;
  retrievedAt: Date | null;
  tables: Array<{
    kind: string;
    payload: any;
    payloadHash: string | null;
    name: string | null;
  }>;
};

function isObject(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null;
}

function toNumber(v: unknown, fieldName: string): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  throw new Error(`TAX_CONFIG_INVALID: field ${fieldName} must be a number`);
}

function pickTable(set: DbParameterSet, kind: string) {
  const t = set.tables.find((x) => x.kind === kind);
  if (!t) {
    throw new Error(`TAX_CONFIG_MISSING_TABLE: ${set.taxType} missing table kind ${kind}`);
  }
  return t;
}

/**
 * Tries hard to accept a few payload shapes so seeds can evolve without breaking code.
 * Canonical recommended payload shapes:
 * - PAYGW_WITHHOLDING: { basis: "WEEKLY", brackets: [...] }
 * - GST_RULES: { rateMilli: 100 }
 */
function extractPaygwBrackets(payload: any): any[] {
  if (!isObject(payload)) throw new Error("TAX_CONFIG_INVALID: PAYGW payload must be an object");

  // Canonical
  if (Array.isArray(payload.brackets)) return payload.brackets;

  // Alternatives we accept
  if (Array.isArray(payload.weeklyBrackets)) return payload.weeklyBrackets;
  if (isObject(payload.table) && Array.isArray(payload.table.brackets)) return payload.table.brackets;

  // Schedules map (we assume weekly basis for the engine)
  if (isObject(payload.schedules)) {
    if (Array.isArray(payload.schedules.WEEKLY)) return payload.schedules.WEEKLY;
    if (Array.isArray(payload.schedules.weekly)) return payload.schedules.weekly;
  }

  throw new Error("TAX_CONFIG_INVALID: PAYGW payload missing brackets");
}

function normalizePaygwBrackets(raw: any[]): Array<{
  thresholdCents: number;
  baseWithholdingCents: number;
  marginalRateMilli: number;
}> {
  const brackets = raw.map((b, i) => {
    if (!isObject(b)) throw new Error(`TAX_CONFIG_INVALID: PAYGW bracket[${i}] must be an object`);
    return {
      thresholdCents: toNumber(b.thresholdCents ?? b.threshold ?? b.fromCents, `brackets[${i}].thresholdCents`),
      baseWithholdingCents: toNumber(
        b.baseWithholdingCents ?? b.baseCents ?? b.base,
        `brackets[${i}].baseWithholdingCents`,
      ),
      marginalRateMilli: toNumber(
        b.marginalRateMilli ?? b.marginalMilli ?? b.rateMilli ?? b.rate,
        `brackets[${i}].marginalRateMilli`,
      ),
    };
  });

  // Ensure ascending thresholds
  brackets.sort((a, b) => a.thresholdCents - b.thresholdCents);
  return brackets;
}

function extractGstRateMilli(payload: any): number {
  if (!isObject(payload)) throw new Error("TAX_CONFIG_INVALID: GST payload must be an object");

  // Canonical
  if (payload.rateMilli != null) return toNumber(payload.rateMilli, "rateMilli");

  // Alternatives
  if (payload.rate_milli != null) return toNumber(payload.rate_milli, "rate_milli");
  if (payload.rateBps != null) return toNumber(payload.rateBps, "rateBps") * 10;

  throw new Error("TAX_CONFIG_INVALID: GST payload missing rateMilli");
}

function metaFromSet(set: DbParameterSet, taxType: TaxType) {
  // Keep this minimal to avoid type drift; cast at return boundary.
  return {
    id: set.id,
    jurisdiction: "AU",
    taxType,
    validFrom: set.effectiveFrom,
    validTo: set.effectiveTo ?? null,
    description: set.sourceName,
    versionTag: set.sourceHash,
    source: {
      name: set.sourceName,
      ref: set.sourceRef ?? undefined,
      hash: set.sourceHash,
      retrievedAt: set.retrievedAt ?? undefined,
    },
  };
}

export class PrismaTaxConfigRepository implements TaxConfigRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getActiveConfig(params: TaxConfigQuery): Promise<AuTaxConfig> {
    assertAuOnly(params.jurisdiction);

    const onDate = params.onDate ?? new Date();
    const taxType = params.taxType;

    // Only AU types we support here
    const auTaxType =
      taxType === TaxType.PAYGW
        ? "PAYGW"
        : taxType === TaxType.GST
          ? "GST"
          : taxType === TaxType.HELP
            ? "HELP"
            : taxType === TaxType.STSL
              ? "STSL"
              : null;

    if (!auTaxType) {
      throw new Error(`TAX_CONFIG_UNSUPPORTED: ${String(taxType)}`);
    }

    const set = (await (this.prisma as any).auTaxParameterSet.findFirst({
      where: {
        taxType: auTaxType,
        status: "ACTIVE",
        effectiveFrom: { lte: onDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: onDate } }],
      },
      orderBy: { effectiveFrom: "desc" },
      include: { tables: true },
    })) as DbParameterSet | null;

    if (!set) {
      throw new Error(`TAX_CONFIG_MISSING: ${auTaxType} @ ${onDate.toISOString().slice(0, 10)}`);
    }

    if (auTaxType === "PAYGW") {
      const table = pickTable(set, "PAYGW_WITHHOLDING");
      const raw = extractPaygwBrackets(table.payload);
      const brackets = normalizePaygwBrackets(raw);

      return {
        meta: metaFromSet(set, TaxType.PAYGW),
        kind: "PAYGW",
        // engine converts gross by payPeriod; table basis is weekly thresholds
        brackets,
      } as any;
    }

    if (auTaxType === "GST") {
      const table = pickTable(set, "GST_RULES");
      const rateMilli = extractGstRateMilli(table.payload);

      return {
        meta: metaFromSet(set, TaxType.GST),
        kind: "GST",
        rateMilli,
      } as any;
    }

    // HELP / STSL can be added once you seed + define payloads
    throw new Error(`TAX_CONFIG_UNIMPLEMENTED: ${auTaxType}`);
  }
}
