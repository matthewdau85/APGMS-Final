export type EvidencePackV1 = {
  version: 1;
  generatedAt: string;

  orgId: string;
  period: string;

  // Optional but strongly recommended (audit)
  specIdFull?: string;
  specVersionHash?: string;
  inputHash?: string;

  payload: unknown;
};
