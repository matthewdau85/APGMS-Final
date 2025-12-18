// packages/domain-policy/src/au-tax/resolve-au-tax-config.ts

import type { JurisdictionCode } from "../tax-types.js";
import {
  TaxType,
  type AuTaxConfigProvider,
  type AuTaxParameterSetRow,
  type AuTaxRateTableKind,
  type GstConfig,
  type PaygwBracket,
  type PaygwConfig,
} from "./types.js";

function financialYearFor(date: Date): string {
  // AU FY starts July 1. Use UTC to avoid local TZ surprises.
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth(); // 0=Jan ... 6=Jul
  const start = m >= 6 ? y : y - 1;
  return `${start}-${start + 1}`;
}

function pickTable(
  set: AuTaxParameterSetRow,
  kind: AuTaxRateTableKind,
): { kind: AuTaxRateTableKind; payload: unknown; payloadHash?: string | null } {
  const t = set.tables?.find((x) => x.kind === kind);
  if (!t) {
    throw new Error(
      `TAX_CONFIG_MISSING: Active parameter set ${set.id} missing required table kind=${kind}`,
    );
  }
  return t;
}

function assertNumber(v: unknown, label: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new Error(`TAX_CONFIG_INVALID: ${label} must be a finite number`);
  }
  return v;
}

function parsePaygwBrackets(payload: unknown): PaygwBracket[] {
  if (!payload || typeof payload !== "object") {
    throw new Error("TAX_CONFIG_INVALID: PAYGW payload must be an object");
  }
  const brackets = (payload as any).brackets;
  if (!Array.isArray(brackets)) {
    throw new Error("TAX_CONFIG_INVALID: PAYGW payload.brackets must be an array");
  }

  return brackets.map((b: any, i: number) => {
    const thresholdCents = assertNumber(b.thresholdCents, `brackets[${i}].thresholdCents`);
    const baseWithholdingCents = assertNumber(
      b.baseWithholdingCents,
      `brackets[${i}].baseWithholdingCents`,
    );
    const marginalRateMilli = assertNumber(
      b.marginalRateMilli,
      `brackets[${i}].marginalRateMilli`,
    );

    return {
      thresholdCents,
      baseWithholdingCents,
      marginalRateMilli,
      flags: b.flags && typeof b.flags === "object" ? b.flags : undefined,
    };
  });
}

function parseGstRateMilli(payload: unknown): number {
  if (!payload || typeof payload !== "object") {
    throw new Error("TAX_CONFIG_INVALID: GST payload must be an object");
  }

  // Accept either:
  // - payload.rateMilli (preferred)
  // - payload.gstRate (decimal, e.g. 0.1), converted to milli units
  const rateMilli = (payload as any).rateMilli;
  if (typeof rateMilli === "number" && Number.isFinite(rateMilli)) return rateMilli;

  const gstRate = (payload as any).gstRate;
  if (typeof gstRate === "number" && Number.isFinite(gstRate)) {
    return Math.round(gstRate * 1000);
  }

  throw new Error("TAX_CONFIG_INVALID: GST payload must include rateMilli or gstRate");
}

export async function resolveAuTaxConfig(params: {
  provider: AuTaxConfigProvider;
  jurisdiction: JurisdictionCode;
  taxType: TaxType.PAYGW | TaxType.GST;
  onDate: Date;
}): Promise<PaygwConfig | GstConfig> {
  const { provider, jurisdiction, taxType, onDate } = params;

  if (!(onDate instanceof Date) || Number.isNaN(onDate.valueOf())) {
    throw new Error("TAX_CONFIG_INVALID: onDate must be a valid Date");
  }

  if (taxType === TaxType.PAYGW) {
    const set = await provider.getActiveParameterSetWithTables({
      taxType: "PAYGW",
      onDate,
    });

    if (!set || set.status !== "ACTIVE") {
      throw new Error("TAX_CONFIG_MISSING: No ACTIVE PAYGW parameter set for date");
    }

    const table = pickTable(set, "PAYGW_WITHHOLDING");
    const brackets = parsePaygwBrackets(table.payload);

    return {
      kind: "PAYGW",
      meta: {
        id: set.id,
        jurisdiction,
        taxType: TaxType.PAYGW,
        financialYear: financialYearFor(onDate),
        validFrom: set.effectiveFrom,
        validTo: set.effectiveTo,
        description: table.payloadHash ?? null,
        source: "ATO",
        versionTag: set.sourceHash,
      },
      jurisdiction,
      taxType: TaxType.PAYGW,
      brackets,
    };
  }

  // GST
  const set = await provider.getActiveParameterSetWithTables({
    taxType: "GST",
    onDate,
  });

  if (!set || set.status !== "ACTIVE") {
    throw new Error("TAX_CONFIG_MISSING: No ACTIVE GST parameter set for date");
  }

  const table = pickTable(set, "GST_RULES");
  const rateMilli = parseGstRateMilli(table.payload);

  return {
    kind: "GST",
    meta: {
      id: set.id,
      jurisdiction,
      taxType: TaxType.GST,
      financialYear: financialYearFor(onDate),
      validFrom: set.effectiveFrom,
      validTo: set.effectiveTo,
      description: table.payloadHash ?? null,
      source: "ATO",
      versionTag: set.sourceHash,
    },
    jurisdiction,
    taxType: TaxType.GST,
    rateMilli,
  };
}
