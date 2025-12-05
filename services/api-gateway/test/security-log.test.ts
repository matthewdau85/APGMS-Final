import { buildSecurityLogEntry } from "@apgms/shared/security-log.js";

describe("security log redaction", () => {
  it("redacts TFN/ABN/bank account numbers in metadata", () => {
    const entry = buildSecurityLogEntry({
      event: "test_event",
      orgId: "org-123",
      principal: "user-1",
      metadata: {
        tfn: "123-456-789",
        abn: "12 345 678 901",
        bankAccountNumber: "123456789",
        safeField: "ok",
      },
    });

    const json = JSON.stringify(entry);

    // Non-PII context should still be present
    expect(json).toContain("org-123");
    expect(json).toContain("test_event");
    expect(json).toContain("safeField");

    // Raw PII must not appear
    expect(json).not.toContain("123-456-789");
    expect(json).not.toContain("12 345 678 901");
    expect(json).not.toContain("123456789");

    // We should see a redacted marker instead
    expect(json).toContain("***redacted***");
  });
});
