import { isWithinEffectiveRange, parseDateOnlyUtc } from "../dateOnly";

describe("dateOnly", () => {
  it("parses YYYY-MM-DD to UTC midnight", () => {
    expect(parseDateOnlyUtc("2025-07-01")).toBe(Date.UTC(2025, 6, 1));
  });

  it("throws on invalid formats", () => {
    expect(() => parseDateOnlyUtc("2025-7-01")).toThrow();
    expect(() => parseDateOnlyUtc("2025-07-01T00:00:00Z")).toThrow();
    expect(() => parseDateOnlyUtc("2025-02-30")).toThrow();
  });

  it("applies exclusive effectiveTo boundary", () => {
    expect(isWithinEffectiveRange("2025-06-30", "2025-06-01", "2025-07-01")).toBe(true);
    expect(isWithinEffectiveRange("2025-07-01", "2025-06-01", "2025-07-01")).toBe(false);
  });
});
