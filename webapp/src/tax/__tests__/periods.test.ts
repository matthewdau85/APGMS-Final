import { normalizePayPeriod } from "../periods";

describe("normalizePayPeriod", () => {
  it("normalizes common variants", () => {
    expect(normalizePayPeriod("weekly")).toBe("WEEKLY");
    expect(normalizePayPeriod("W")).toBe("WEEKLY");
    expect(normalizePayPeriod("fortnightly")).toBe("FORTNIGHTLY");
    expect(normalizePayPeriod("fn")).toBe("FORTNIGHTLY");
    expect(normalizePayPeriod("monthly")).toBe("MONTHLY");
    expect(normalizePayPeriod("mo")).toBe("MONTHLY");
  });

  it("throws on unknown", () => {
    expect(() => normalizePayPeriod("daily")).toThrow();
  });
});
