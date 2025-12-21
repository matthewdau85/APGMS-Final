export interface EvidencePack {
  inputDataHash: string;

  taxSpec: {
    id: string;
    version: string;
    jurisdiction: string;
    effectiveFrom: string;
  };

  computation: {
    timestamp: string; // ISO-8601
    period: string;
  };

  outputs: {
    obligations: unknown;
  };

  ledger: {
    entries: unknown[];
    ledgerHash: string;
  };

  system: {
    gitSha: string;
  };

  readiness: {
    status: "GREEN" | "AMBER" | "RED";
    checkedAt: string;
  };
}
