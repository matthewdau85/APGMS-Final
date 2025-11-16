import { BuildOptions, PayrollEventInput, PayrollEmployee, PayrollIncomeBreakdown, SingleTouchPayrollPayload } from "./types.js";

function calculateAllowances(income: PayrollIncomeBreakdown): number {
  return income.allowances?.reduce((sum, allowance) => sum + allowance.amount, 0) ?? 0;
}

function calculateDeductions(income: PayrollIncomeBreakdown): number {
  return income.deductions?.reduce((sum, deduction) => sum + deduction.amount, 0) ?? 0;
}

function calculateTaxableGross(income: PayrollIncomeBreakdown): number {
  const allowances = calculateAllowances(income);
  const deductions = calculateDeductions(income);
  return Number(
    (
      income.ordinaryTimeEarnings +
      (income.overtimeEarnings ?? 0) +
      allowances -
      deductions
    ).toFixed(2)
  );
}

function normalizeEmployee(employee: PayrollEmployee) {
  return {
    payrollId: employee.payrollId,
    taxFileNumber: employee.taxFileNumber,
    givenName: employee.givenName,
    familyName: employee.familyName,
    dateOfBirth: employee.dateOfBirth,
    residentialAddress: {
      ...employee.residentialAddress,
      countryCode: employee.residentialAddress.countryCode ?? "AUS",
    },
    income: {
      taxableGross: calculateTaxableGross(employee.income),
      taxWithheld: Number(employee.income.paygWithholding.toFixed(2)),
      superannuationGuarantee: Number(employee.income.superGuarantee.toFixed(2)),
      allowances: employee.income.allowances,
      deductions: employee.income.deductions,
    },
  } as const;
}

function calculateTotals(employees: PayrollEmployee[]) {
  return employees.reduce(
    (totals, employee) => {
      totals.gross += calculateTaxableGross(employee.income);
      totals.taxWithheld += employee.income.paygWithholding;
      totals.superannuationGuarantee += employee.income.superGuarantee;
      return totals;
    },
    { gross: 0, taxWithheld: 0, superannuationGuarantee: 0 }
  );
}

export function buildStpPayload(event: PayrollEventInput, options: BuildOptions = {}): SingleTouchPayrollPayload {
  if (event.employees.length === 0) {
    throw new Error("Payroll event must include at least one employee");
  }

  const totals = calculateTotals(event.employees);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const specificationVersion = options.specificationVersion ?? "2.0.0";

  const bas = event.basSummary
    ? {
        ...event.basSummary,
        reportingPeriod: `${event.periodStart}/${event.periodEnd}`,
      }
    : undefined;

  const payload: SingleTouchPayrollPayload = {
    specification: "ATO-STP-PHASE-2",
    version: specificationVersion,
    metadata: {
      generatedAt,
    },
    transmission: {
      id: event.payer.transmissionId,
      payerAbn: event.payer.abn,
      branchNumber: event.payer.branchNumber,
      softwareId: event.payer.softwareId,
    },
    payer: event.payer,
    payRun: {
      id: event.payRunId,
      periodStart: event.periodStart,
      periodEnd: event.periodEnd,
      paymentDate: event.paymentDate,
      totals: {
        gross: Number(totals.gross.toFixed(2)),
        taxWithheld: Number(totals.taxWithheld.toFixed(2)),
        superannuationGuarantee: Number(totals.superannuationGuarantee.toFixed(2)),
      },
      bas,
      events: event.employees.map(normalizeEmployee),
    },
  };

  return payload;
}
