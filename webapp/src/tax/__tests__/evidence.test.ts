import { makeEvidenceRef } from "../evidence";

describe("makeEvidenceRef", () => {
  it("builds deterministic evidencePackId and manifestHash", () => {
    const ref = makeEvidenceRef({
      taxType: "AU_PAYGW",
      pluginVersion: "1.0.0",
      configId: "au-paygw-2025-07",
      specVersion: "paygw-brackets-v2",
      asAt: "2025-07-01",
    });

    expect(ref.evidencePackId).toBe("AU_PAYGW:au-paygw-2025-07:2025-07-01");
    expect(ref.manifestHash).toBe("25e3d2f8");

    const ref2 = makeEvidenceRef({
      taxType: "AU_PAYGW",
      pluginVersion: "1.0.0",
      configId: "au-paygw-2025-07",
      specVersion: "paygw-brackets-v2",
      asAt: "2025-07-01",
    });

    expect(ref2.manifestHash).toBe(ref.manifestHash);
  });
});
