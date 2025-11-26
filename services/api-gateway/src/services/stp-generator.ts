// services/api-gateway/src/services/stp-generator.ts
export type PayEventEmployee = {
  taxFileNumber: string;
  grossCents: number;
  paygWithheldCents: number;
};

export type StpPayEvent = {
  payerAbn: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  payDate: string;
  employees: PayEventEmployee[];
};

/**
 * Generates a minimal STP-style payload for PAYGW.
 * This is intentionally not the full ATO XML schema â€“ it's a logical representation.
 */
export function generateStpPayload(event: StpPayEvent): unknown {
  const totalGross = event.employees.reduce(
    (sum, e) => sum + e.grossCents,
    0,
  );
  const totalWithheld = event.employees.reduce(
    (sum, e) => sum + e.paygWithheldCents,
    0,
  );

  return {
    version: "STP-APGMS-0.1",
    payer: {
      abn: event.payerAbn,
    },
    period: {
      start: event.payPeriodStart,
      end: event.payPeriodEnd,
      payDate: event.payDate,
    },
    totals: {
      grossCents: totalGross,
      paygWithheldCents: totalWithheld,
    },
    employees: event.employees.map((e) => ({
      tfn: e.taxFileNumber,
      grossCents: e.grossCents,
      paygWithheldCents: e.paygWithheldCents,
    })),
  };
}
