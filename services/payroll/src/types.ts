export interface PayrollAddress {
  line1: string;
  line2?: string;
  suburb: string;
  state: string;
  postcode: string;
  countryCode?: string;
}

export interface PayrollAllowance {
  code: string;
  description: string;
  amount: number;
}

export interface PayrollDeduction {
  code: string;
  description: string;
  amount: number;
}

export interface PayrollIncomeBreakdown {
  ordinaryTimeEarnings: number;
  overtimeEarnings?: number;
  allowances?: PayrollAllowance[];
  deductions?: PayrollDeduction[];
  paygWithholding: number;
  superGuarantee: number;
}

export interface PayrollEmployee {
  payrollId: string;
  taxFileNumber: string;
  givenName: string;
  familyName: string;
  dateOfBirth: string;
  residentialAddress: PayrollAddress;
  income: PayrollIncomeBreakdown;
}

export interface PayrollPayer {
  abn: string;
  branchNumber: string;
  contactName: string;
  phone: string;
  softwareId: string;
  transmissionId: string;
}

export interface BasSummary {
  gstOnSales: number;
  gstOnPurchases: number;
  paygWithholding: number;
  paygInstalment: number;
}

export interface PayrollEventInput {
  payRunId: string;
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  payer: PayrollPayer;
  employees: PayrollEmployee[];
  basSummary?: BasSummary;
}

export interface EmployeeIncomeSummary {
  taxableGross: number;
  taxWithheld: number;
  superannuationGuarantee: number;
  allowances?: PayrollAllowance[];
  deductions?: PayrollDeduction[];
}

export interface EmployeeStpEvent {
  payrollId: string;
  taxFileNumber: string;
  givenName: string;
  familyName: string;
  dateOfBirth: string;
  residentialAddress: PayrollAddress;
  income: EmployeeIncomeSummary;
}

export interface PayRunTotals {
  gross: number;
  taxWithheld: number;
  superannuationGuarantee: number;
}

export interface BasDeclarationPayload extends BasSummary {
  reportingPeriod: string;
}

export interface SingleTouchPayrollPayload {
  specification: "ATO-STP-PHASE-2";
  version: string;
  metadata: {
    generatedAt: string;
  };
  transmission: {
    id: string;
    payerAbn: string;
    branchNumber: string;
    softwareId: string;
  };
  payer: PayrollPayer;
  payRun: {
    id: string;
    periodStart: string;
    periodEnd: string;
    paymentDate: string;
    totals: PayRunTotals;
    bas?: BasDeclarationPayload;
    events: EmployeeStpEvent[];
  };
}

export interface BuildOptions {
  specificationVersion?: string;
  generatedAt?: string;
}
