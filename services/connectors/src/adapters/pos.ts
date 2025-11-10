import { randomUUID } from "node:crypto";

import type { TaxEngineClient } from "../tax-engine.js";
import { roundCurrency } from "../util.js";
import type {
  DesignatedAccountCreditor,
  EventPublisher,
  ObligationEventEnvelope,
} from "../types.js";

const DEFAULT_SCHEMA_VERSION = "apgms.obligation.v1";
const DEFAULT_SUBJECT = "apgms.obligation.calculated";
const DEFAULT_SOURCE = "adapter/pos";

export type PosSaleClassification = "taxable" | "gst_free" | "input_taxed";

export type PosSale = {
  saleId: string;
  total: number;
  classification?: PosSaleClassification;
  reference?: string;
  metadata?: Record<string, unknown>;
};

export type PosPayload = {
  orgId: string;
  batchId: string;
  occurredAt?: string;
  sales: ReadonlyArray<PosSale>;
  metadata?: Record<string, unknown>;
};

export type PosAdapterDependencies = {
  taxEngine: TaxEngineClient;
  publisher: EventPublisher;
  subject?: string;
  schemaVersion?: string;
  source?: string;
  idFactory?: () => string;
  clock?: () => Date;
  gstRate?: number;
  designatedAccountCredit?: DesignatedAccountCreditor;
  actorId?: string;
};

export async function ingestPosBatch(
  payload: PosPayload,
  deps: PosAdapterDependencies,
): Promise<ObligationEventEnvelope> {
  const idFactory = deps.idFactory ?? randomUUID;
  const nowIso = (deps.clock?.() ?? new Date()).toISOString();
  const occurredAt = payload.occurredAt ?? nowIso;
  const gstRate = deps.gstRate ?? 0.1;

  const lineResults = await Promise.all(
    payload.sales.map(async (sale) => {
      const classification: PosSaleClassification = sale.classification ?? "taxable";
      const gross = roundCurrency(sale.total);
      if (gross <= 0) {
        return {
          reference: sale.reference ?? sale.saleId,
          basis: 0,
          gst: 0,
          net: 0,
          classification,
        };
      }

      if (classification !== "taxable") {
        return {
          reference: sale.reference ?? sale.saleId,
          basis: gross,
          gst: 0,
          net: gross,
          classification,
        };
      }

      const result = await deps.taxEngine.calculateGst({ amount: gross, rate: gstRate });
      return {
        reference: sale.reference ?? sale.saleId,
        basis: gross,
        gst: roundCurrency(result.gstPortion),
        net: roundCurrency(result.netOfGst),
        classification,
      };
    }),
  );

  const taxableLines = lineResults.filter((line) => line.classification === "taxable");
  const basisAmount = taxableLines.reduce((acc, line) => acc + line.basis, 0);
  const obligationAmount = taxableLines.reduce((acc, line) => acc + line.gst, 0);
  const netOfTaxTotal = taxableLines.reduce((acc, line) => acc + line.net, 0);

  const roundedBasis = roundCurrency(basisAmount);
  const roundedObligation = roundCurrency(obligationAmount);
  const roundedNet = roundCurrency(netOfTaxTotal);
  const effectiveRate = basisAmount > 0 ? obligationAmount / basisAmount : 0;

  const envelope: ObligationEventEnvelope = {
    id: idFactory(),
    dedupeId: idFactory(),
    orgId: payload.orgId,
    eventType: "obligation.calculated",
    key: `${payload.orgId}:${payload.batchId}`,
    schemaVersion: deps.schemaVersion ?? DEFAULT_SCHEMA_VERSION,
    source: deps.source ?? DEFAULT_SOURCE,
    ts: nowIso,
    payload: {
      obligationType: "GST",
      obligationAmount: roundedObligation,
      basisAmount: roundedBasis,
      netOfTax: roundedNet,
      effectiveRate,
      sourceSystem: "POS",
      reference: payload.batchId,
      occurredAt,
      metadata: {
        saleCount: payload.sales.length,
        taxableCount: taxableLines.length,
        gstRate,
        ...payload.metadata,
      },
      breakdown: {
        lineItems: lineResults.map((line) => ({
          reference: line.reference,
          basisAmount: roundCurrency(line.basis),
          obligationAmount: roundCurrency(line.gst),
          metadata: { classification: line.classification },
        })),
      },
    },
  };

  await deps.publisher.publish(deps.subject ?? DEFAULT_SUBJECT, envelope);

  if (deps.designatedAccountCredit && roundedObligation > 0) {
    await deps.designatedAccountCredit({
      orgId: payload.orgId,
      accountType: "GST",
      amount: roundedObligation,
      source: "GST_CAPTURE",
      actorId: deps.actorId ?? "system",
    });
  }

  return envelope;
}
