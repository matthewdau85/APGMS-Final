// services/api-gateway/test/security-log.spec.ts
import { buildSecurityLogEntry, logSecurityEvent } from "../../../shared/src/security-log";

describe("security logging redaction", () => {
  it("redacts common PII fields (TFN/ABN/bank details) in logs", () => {
    const rawEntry = buildSecurityLogEntry({
      event: "test_event",
      orgId: "org-123",
      principal: "user-1",
      metadata: {
        tfn: "123-456-789",
        abn: "12 345 678 901",
        bankAccountNumber: "123456789",
        safeField: "hello",
      },
    });

    const captured: any[] = [];
    const fakeLogger = {
      info: (payload: unknown) => {
        captured.push(payload);
      },
    };

    logSecurityEvent(fakeLogger, rawEntry);

    expect(captured).toHaveLength(1);
    const logged = captured[0] as any;

    // Security wrapper present
    expect(logged).toHaveProperty("security");

    const security = logged.security;

    // Safe fields remain
    expect(security.orgId).toBe("org-123");
    expect(security.metadata.safeField).toBe("hello");

    const loggedMetadata = JSON.stringify(security.metadata);

    // Sensitive values should not appear in cleartext
    expect(loggedMetadata).not.toContain("123-456-789");
    expect(loggedMetadata).not.toContain("12 345 678 901");
    expect(loggedMetadata).not.toContain("123456789");
  });
});
