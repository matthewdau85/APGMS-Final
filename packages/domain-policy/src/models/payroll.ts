export interface PayrollBatch {
  id: string;
  orgId: string;
  payPeriod: string;
  employees: PayrollEntry[];
}

export interface PayrollEntry {
  id: string; employeeId: string; gross: number; taxWithheld: number; superannuation: number;
}
