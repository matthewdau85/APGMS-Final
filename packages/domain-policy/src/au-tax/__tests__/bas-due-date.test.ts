// packages/domain-policy/src/au-tax/__tests__/bas-due-date.test.ts

import { computeBasDueDate, type BasDueDateRule, type HolidayCalendar } from "../bas-due-date.js";

const rules: BasDueDateRule[] = [
  {
    applies_to: { entity_type: "small_business", frequency: "quarterly" },
    due_day: 28,
    due_month_offset: 1,
  },
  {
    applies_to: { entity_type: "small_business", frequency: "monthly" },
    due_day: 21,
    due_month_offset: 1,
  },
];

const holidayCalendar: HolidayCalendar = {
  isHoliday: (date: Date) => {
    const iso = date.toISOString().slice(0, 10);
    // A single synthetic holiday for test determinism.
    return iso === "2025-11-21";
  },
};

describe("computeBasDueDate", () => {
  it("computes quarterly BAS due date (basic rule)", () => {
    const due = computeBasDueDate({
      periodEndDate: "2025-03-31",
      frequency: "quarterly",
      entity_type: "small_business",
      dueDateRules: rules,
    });
    expect(due.toISOString().slice(0, 10)).toBe("2025-04-28");
  });

  it("shifts weekend to Monday", () => {
    // Period end 2025-05-31 (monthly) => due 2025-06-21 (Saturday) => shift to Monday 2025-06-23
    const due = computeBasDueDate({
      periodEndDate: "2025-05-31",
      frequency: "monthly",
      entity_type: "small_business",
      dueDateRules: rules,
    });
    expect(due.getUTCDay()).toBe(1);
    expect(due.toISOString().slice(0, 10)).toBe("2025-06-23");
  });

  it("shifts holidays forward and still respects weekends", () => {
    // Period end 2025-10-31 (monthly) => due 2025-11-21 (holiday) => 2025-11-22 (Sat) => 2025-11-24 (Mon)
    const due = computeBasDueDate({
      periodEndDate: "2025-10-31",
      frequency: "monthly",
      entity_type: "small_business",
      dueDateRules: rules,
      holidayCalendar,
    });
    expect(due.getUTCDay()).toBe(1);
    expect(due.toISOString().slice(0, 10)).toBe("2025-11-24");
  });
});
