import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface OrgRiskSnapshot {
  orgId: string;
  period: string;
  bufferCoveragePct: number;
  fundingConsistencyPct: number;
  overallLevel: RiskLevel;
}

export async function computeOrgRisk(orgId: string, period: string): Promise<OrgRiskSnapshot> {
  // Very simple placeholder logic.
  // TODO: plug into real obligations + buffers.
  const bufferCoveragePct = 80; // e.g., 80% of required PAYGW+GST is covered
  const fundingConsistencyPct = 70; // e.g., % of weeks adequately funded

  let overallLevel: RiskLevel = 'LOW';
  if (bufferCoveragePct < 90 || fundingConsistencyPct < 80) overallLevel = 'MEDIUM';
  if (bufferCoveragePct < 70 || fundingConsistencyPct < 60) overallLevel = 'HIGH';

  return {
    orgId,
    period,
    bufferCoveragePct,
    fundingConsistencyPct,
    overallLevel,
  };
}
