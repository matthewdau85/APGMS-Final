import { BasPeriod, type BasPeriodId } from "../src/bas-period";

describe("BasPeriod Value Object", () => {
  // ----------------------------------------------------------------
  // 1. Factory Method: fromQuarter
  // ----------------------------------------------------------------
  describe("fromQuarter", () => {
    test("creates a valid Q1 string", () => {
      const result = BasPeriod.fromQuarter(2024, 1);
      expect(result).toBe("2024-Q1");
    });

    test("creates a valid Q4 string", () => {
      const result = BasPeriod.fromQuarter(2025, 4);
      expect(result).toBe("2025-Q4");
    });
  });

  // ----------------------------------------------------------------
  // 2. Factory Method: fromMonth
  // ----------------------------------------------------------------
  describe("fromMonth", () => {
    test("pads single digit months with zero", () => {
      const result = BasPeriod.fromMonth(2024, 1);
      expect(result).toBe("2024-01");
    });

    test("accepts double digit months without change", () => {
      const result = BasPeriod.fromMonth(2024, 10);
      expect(result).toBe("2024-10");
    });

    test("throws error for month 0", () => {
      expect(() => {
        BasPeriod.fromMonth(2024, 0);
      }).toThrow("Invalid month");
    });

    test("throws error for month 13", () => {
      expect(() => {
        BasPeriod.fromMonth(2024, 13);
      }).toThrow("Invalid month");
    });
  });

  // ----------------------------------------------------------------
  // 3. Parser / Validation Logic
  // ----------------------------------------------------------------
  describe("parse", () => {
    // --- Happy Paths ---
    test("accepts valid quarterly format", () => {
      const input = "2023-Q3";
      const result = BasPeriod.parse(input);
      expect(result).toBe(input);
    });

    test("accepts valid monthly format", () => {
      const input = "2023-11";
      const result = BasPeriod.parse(input);
      expect(result).toBe(input);
    });

    // --- Sad Paths (Validation) ---
    test("rejects invalid quarter number (Q5)", () => {
      expect(() => {
        BasPeriod.parse("2024-Q5");
      }).toThrow(/Invalid BAS Period ID/);
    });

    test("rejects invalid month number (13)", () => {
      expect(() => {
        BasPeriod.parse("2024-13");
      }).toThrow(/Invalid BAS Period ID/);
    });

    test("rejects malformed separator (2024/Q1)", () => {
      expect(() => {
        BasPeriod.parse("2024/Q1");
      }).toThrow(/Invalid BAS Period ID/);
    });

    test("rejects non-numeric year (ABCD-Q1)", () => {
      expect(() => {
        BasPeriod.parse("ABCD-Q1");
      }).toThrow(/Invalid BAS Period ID/);
    });

    test("rejects garbage strings", () => {
      expect(() => {
        // @ts-expect-error – deliberately wrong
        BasPeriod.parse("Monthly-BAS");
      }).toThrow();
    });
  });

  // ----------------------------------------------------------------
  // 4. Ordering (string comparison)
  // ----------------------------------------------------------------
  describe("Ordering (String comparison)", () => {
    test("monthly then quarterly in simple sort", () => {
      const list = ["2024-Q1", "2024-01"];
      list.sort();
      expect(list).toEqual(["2024-01", "2024-Q1"]);
    });

    test("chronological ordering holds for quarterly", () => {
      const periods = ["2024-Q2", "2023-Q4", "2024-Q1"];
      periods.sort();
      expect(periods).toEqual(["2023-Q4", "2024-Q1", "2024-Q2"]);
    });
  });
});
