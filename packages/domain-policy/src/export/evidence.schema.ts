export interface EvidencePackV1 {
  schemaVersion: "v1";

  inputDataHash: string;

  taxSpec: {
    id: string;
    version: string;
    jurisdiction: string;
    effectivePeriod: string;
  };

  computation: {
    timestamp: string; // ISO
    systemVersion: string; // git SHA
    readinessSnapshot: {
      availability: "GREEN" | "RED";
      performance: "GREEN" | "RED";
    };
  };

  outputs: {
    obligations: unknown; // already typed elsewhere
    ledgerEntryIds: string[];
  };

  checksum?: string; // populated post-validation
}
