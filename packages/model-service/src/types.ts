export interface EmployeeRecord {
  id: string;
  orgId: string;
  employmentType: string;
  baseRate: number;
  superRate: number;
  status: string;
  createdAt: string;
}

export interface PayRunRecord {
  id: string;
  orgId: string;
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  status: string;
  createdAt: string;
}

export interface PayslipRecord {
  id: string;
  payRunId: string;
  employeeId: string;
  grossPay: number;
  paygWithheld: number;
  superAccrued: number;
  createdAt: string;
}

export interface PayrollDataset {
  employees: EmployeeRecord[];
  payRuns: PayRunRecord[];
  payslips: PayslipRecord[];
}

export interface PayrollFeatureRecord {
  employeeId: string;
  payRunId: string;
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  grossPay: number;
  paygWithheld: number;
  superAccrued: number;
  netPay: number;
  payPeriodDays: number;
  grossPerDay: number;
}

export interface NormalizationStats {
  field: keyof PayrollFeatureRecord;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
}

export interface NormalizedFeatureSet {
  records: PayrollFeatureRecord[];
  stats: NormalizationStats[];
}

export interface PipelineMetadata {
  version: string;
  generatedAt: string;
  sourceDataset: string;
  recordCount: number;
  featureSchema: Array<{
    name: keyof PayrollFeatureRecord;
    type: 'string' | 'number';
    description: string;
  }>;
  normalization: NormalizationStats[];
}
