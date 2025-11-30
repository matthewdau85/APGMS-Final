export interface PayrollBatch {
  id?: string;
  orgId: string;
  payPeriod?: string;
  basPeriodId?: string;
  /**
   * Legacy field for payroll entries; aligns with API gateway route payloads.
   */
  lines?: PayrollEntry[];
  employees?: PayrollEntry[];
}

export interface PayrollEntry {
  id: string; employeeId: string; gross: number; taxWithheld: number; superannuation: number;
}
