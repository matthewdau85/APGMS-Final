import type { JurisdictionCode } from "../tax-types.js";
import {
  TaxType,
  type AuTaxConfigProvider,
  type PaygwConfig,
  type GstConfig,
} from "./types.js";

/**
 * Resolve AU tax configuration for a given tax type + date.
 *
 * Mechanical goals:
 * - No imports of missing types.
 * - No implicit any under strict mode.
 * - PAYGW brackets must match engine shape (baseCents, rate).
 * - Do not attach unknown properties (e.g. meta) unless types permit.
 */
export async function resolveAuTaxConfig(params: {
  provider: AuTaxConfigProvider;
  jurisdiction: JurisdictionCode;
  taxType: TaxType.PAYGW | TaxType.GST;
  onDate: Date;
}): Promise<PaygwConfig | GstConfig> {
  const { provider, jurisdiction, taxType, onDate } = params;

  const set: any = await provider.getActiveParameterSetWithTables({
    taxType,
    onDate,
  });

  if (!set || set.status !== "ACTIVE") {
    throw new Error(`TAX_CONFIG_MISSING: No ACTIVE ${taxType} config`);
  }

  function getTable(kind: string): any {
    const t = set.tables?.find((x: any) => x.kind === kind);
    if (!t) {
      throw new Error(`TAX_CONFIG_MISSING: No ${kind} table for ${taxType}`);
    }
    return t;
  }

  if (taxType === TaxType.PAYGW) {
    const table = getTable("PAYGW_WITHHOLDING");

    const payload: any = table.payload ?? {};
    const rawBrackets: any[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.brackets)
        ? payload.brackets
        : [];

    const brackets = rawBrackets.map((b: any) => ({
      thresholdCents: Number(b.thresholdCents ?? b.threshold ?? 0),
      baseCents: Number(b.baseCents ?? b.baseWithholdingCents ?? b.base ?? 0),
      rate: Number(b.rate ?? b.marginalRateMilli ?? b.rateMilli ?? 0),
      flags: b.flags ?? undefined,
    }));

    return {
      jurisdiction,
      taxType: TaxType.PAYGW,
      effectiveFrom: set.effectiveFrom,
      effectiveTo: set.effectiveTo ?? null,
      brackets,
    } as any;
  }

  // GST
  const gstTable = getTable("GST_RATES");
  const gstPayload: any = gstTable.payload ?? {};
  const rateMilli = Number(gstPayload.rateMilli ?? gstPayload.rate ?? 100);

  return {
    jurisdiction,
    taxType: TaxType.GST,
    effectiveFrom: set.effectiveFrom,
    effectiveTo: set.effectiveTo ?? null,
    rateMilli,
  } as any;
}
