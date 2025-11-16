// services/stp-generator/index.ts
// Simple STP payload generator for PAYGW records.

export interface StpRecord {
  employeeId: string;
  payDate: string; // ISO date string
  grossAmount: number;
  taxWithheld: number;
}

/**
 * Generate a STP JSON payload from a list of PAYGW records.
 * You can adapt this to output STP-compliant XML later.
 */
export function generateStpFile(records: StpRecord[]): string {
  const payload = {
    generatedAt: new Date().toISOString(),
    recordCount: records.length,
    records,
  };
  return JSON.stringify(payload, null, 2);
}
