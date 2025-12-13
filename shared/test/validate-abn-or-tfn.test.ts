import { validateAbnOrTfn } from "../src/operations/validate-abn-or-tfn.js";

describe("validateAbnOrTfn", () => {
  const realEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...realEnv };
  });

  afterAll(() => {
    process.env = realEnv;
  });

  it("rejects invalid ABN checksum without calling HTTP", async () => {
    process.env.ABR_VALIDATION_MODE = "http";
    process.env.ABR_LOOKUP_BASE_URL = "http://example";

    const fetchSpy = jest.spyOn(globalThis as any, "fetch").mockImplementation(() => {
      throw new Error("fetch should not be called");
    });

    const res = await validateAbnOrTfn("12345678901"); // checksum likely fails
    expect(res.kind).toBe("ABN");
    expect(res.isValidFormat).toBe(false);
    fetchSpy.mockRestore();
  });

  it("ABN checksum ok + HTTP adapter returns valid", async () => {
    process.env.ABR_VALIDATION_MODE = "http";
    process.env.ABR_LOOKUP_BASE_URL = "http://abr-proxy.local";
    process.env.ABR_LOOKUP_TIMEOUT_MS = "2000";

    const fetchSpy = jest.spyOn(globalThis as any, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        abn: "51824753556",
        isValid: true,
        entityName: "TEST PTY LTD",
        entityStatus: "ACTIVE",
      }),
    } as any);

    // 51824753556 is a commonly used example ABN that passes checksum in many test suites
    const res = await validateAbnOrTfn("51 824 753 556");
    expect(res.kind).toBe("ABN");
    expect(res.isValidFormat).toBe(true);
    expect(res.source).toBe("abr");
    expect(res.isVerified).toBe(true);
    expect((res as any).entityName).toBe("TEST PTY LTD");

    fetchSpy.mockRestore();
  });

  it("TFN is checksum-only (no HTTP)", async () => {
    const fetchSpy = jest.spyOn(globalThis as any, "fetch").mockImplementation(() => {
      throw new Error("fetch should not be called");
    });

    const res = await validateAbnOrTfn("123456782"); // likely invalid checksum
    expect(res.kind).toBe("TFN");
    expect(res.isVerified).toBe(false);

    fetchSpy.mockRestore();
  });

  it("production fails fast if ABR HTTP config missing", async () => {
    process.env.NODE_ENV = "production";
    process.env.ABR_VALIDATION_MODE = "auto";
    delete process.env.ABR_LOOKUP_BASE_URL;

    await expect(validateAbnOrTfn("51 824 753 556")).rejects.toThrow(
      /ABR_LOOKUP_BASE_URL is required/i
    );
  });
});
