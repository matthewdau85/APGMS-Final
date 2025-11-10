import { randomUUID } from "node:crypto";

import type { PaygwCalculationInput, PaygwBracket, TaxEngineClient } from "../tax-engine.js";
import { roundCurrency } from "../util.js";
import type {
  DesignatedAccountCreditor,
  ObligationEventEnvelope,
  EventPublisher,
} from "../types.js";

const DEFAULT_SCHEMA_VERSION = "apgms.obligation.v1";
const DEFAULT_SUBJECT = "apgms.obligation.calculated";
const DEFAULT_SOURCE = "adapter/payroll";

export type PayrollEmployee = {
  employeeId: string;
  taxableIncome: number;
  reference?: string;
  metadata?: Record<string, unknown>;
};

export type PayrollPayload = {
  orgId: string;
  payrollRunId: string;
  payPeriod: { start: string; end: string };
  occurredAt?: string;
  employees: ReadonlyArray<PayrollEmployee>;
  metadata?: Record<string, unknown>;
};

export type PayrollAdapterDependencies = {
  taxEngine: TaxEngineClient;
  paygwBrackets: ReadonlyArray<PaygwBracket>;
  publisher: EventPublisher;
  subject?: string;
  schemaVersion?: string;
  source?: string;
  idFactory?: () => string;
  clock?: () => Date;
  designatedAccountCredit?: DesignatedAccountCreditor;
  actorId?: string;
};

export async function ingestPayrollRun(
  payload: PayrollPayload,
  deps: PayrollAdapterDependencies,
): Promise<ObligationEventEnvelope> {
  if (!deps.paygwBrackets || deps.paygwBrackets.length === 0) {
    throw new Error("paygw brackets are required");
  }

  const idFactory = deps.idFactory ?? randomUUID;
  const nowIso = (deps.clock?.() ?? new Date()).toISOString();
  const occurredAt = payload.occurredAt ?? nowIso;

  const lineResults = await Promise.all(
    payload.employees.map(async (line) => {
      const taxableIncome = Math.max(0, roundCurrency(line.taxableIncome));
      if (taxableIncome <= 0) {
        return { reference: line.reference ?? line.employeeId, basis: 0, withheld: 0 };
      }

      const request: PaygwCalculationInput = {
        taxableIncome,
        brackets: deps.paygwBrackets,
      };
      const result = await deps.taxEngine.calculatePaygw(request);
      return {
        reference: line.reference ?? line.employeeId,
        basis: taxableIncome,
        withheld: roundCurrency(result.withheld),
      };
    }),
  );

  const basisAmount = lineResults.reduce((acc, line) => acc + line.basis, 0);
  const obligationAmount = lineResults.reduce((acc, line) => acc + line.withheld, 0);
  const roundedBasis = roundCurrency(basisAmount);
  const roundedObligation = roundCurrency(obligationAmount);
  const effectiveRate = basisAmount > 0 ? obligationAmount / basisAmount : 0;

  const envelope: ObligationEventEnvelope = {
    id: idFactory(),
    dedupeId: idFactory(),
    orgId: payload.orgId,
    eventType: "obligation.calculated",
    key: `${payload.orgId}:${payload.payrollRunId}`,
    schemaVersion: deps.schemaVersion ?? DEFAULT_SCHEMA_VERSION,
    source: deps.source ?? DEFAULT_SOURCE,
    ts: nowIso,
    payload: {
      obligationType: "PAYGW",
      obligationAmount: roundedObligation,
      basisAmount: roundedBasis,
      netOfTax: roundCurrency(roundedBasis - roundedObligation),
      effectiveRate,
      sourceSystem: "PAYROLL",
      reference: payload.payrollRunId,
      occurredAt,
      metadata: {
        employeeCount: payload.employees.length,
        payPeriod: payload.payPeriod,
        ...payload.metadata,
      },
      breakdown: {
        lineItems: lineResults.map((line) => ({
          reference: line.reference,
          basisAmount: roundCurrency(line.basis),
          obligationAmount: roundCurrency(line.withheld),
        })),
      },
    },
  };

  await deps.publisher.publish(deps.subject ?? DEFAULT_SUBJECT, envelope);

  if (deps.designatedAccountCredit && roundedObligation > 0) {
    await deps.designatedAccountCredit({
      orgId: payload.orgId,
      accountType: "PAYGW",
      amount: roundedObligation,
      source: "PAYROLL_CAPTURE",
      actorId: deps.actorId ?? "system",
    });
  }

  return envelope;
}
