// packages/domain-policy/src/bas-period.ts
//
// Branded BAS period identifier and helpers.
// Valid formats:
//   - Quarterly: "2024-Q1" .. "2024-Q4"
//   - Monthly:   "2024-01" .. "2024-12"

declare const __BasPeriodIdBrand: unique symbol;
export type BasPeriodId = string & { [__BasPeriodIdBrand]: void };

const BAS_PERIOD_REGEX = /^\d{4}-(?:Q[1-4]|0[1-9]|1[0-2])$/;

export const BasPeriod = {
  fromQuarter(year: number, quarter: 1 | 2 | 3 | 4): BasPeriodId {
    return `${year}-Q${quarter}` as BasPeriodId;
  },

  fromMonth(year: number, month: number): BasPeriodId {
    if (month < 1 || month > 12) {
      throw new Error(`Invalid month: ${month}`);
    }
    const m = month.toString().padStart(2, "0");
    return `${year}-${m}` as BasPeriodId;
  },

  parse(input: string): BasPeriodId {
    if (!BAS_PERIOD_REGEX.test(input)) {
      throw new Error(`Invalid BAS Period ID format: ${input}`);
    }
    return input as BasPeriodId;
  },

  isValid(input: string): input is BasPeriodId {
    return BAS_PERIOD_REGEX.test(input);
  },
};
