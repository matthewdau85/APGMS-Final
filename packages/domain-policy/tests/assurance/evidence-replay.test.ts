import { hashEvidencePack } from "../../src/evidence/hashEvidencePack";

test("same evidence yields same hash", () => {
  const pack = {
    inputDataHash: "abc",
    taxSpec: { id: "AU-GST", version: "1", jurisdiction: "AU", effectiveFrom: "2024-07-01" },
    computation: { timestamp: "2025-01-01T00:00:00Z", period: "2025-Q1" },
    outputs: { obligations: { gst: 100 } },
    ledger: { entries: [], ledgerHash: "xyz" },
    system: { gitSha: "deadbeef" },
    readiness: { status: "GREEN", checkedAt: "2025-01-01T00:00:00Z" },
  };

  expect(hashEvidencePack(pack)).toEqual(hashEvidencePack(pack));
});
