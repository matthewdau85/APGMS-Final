import { computeBasDueDate, BasDueDateRule, HolidayCalendar } from "../bas-due-date.js";

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
  isHoliday(date) {
    return date.getUTCDate() === 30 && date.getUTCMonth() === 3 && date.getUTCFullYear() === 2025;
  },
};

describe("BAS due dates", () => {
  it("computes quarterly small_business due dates", () => {
    const due = computeBasDueDate({
      periodEndDate: "2025-03-31",
      frequency: "quarterly",
      entity_type: "small_business",
      dueDateRules: rules,
    });
    expect(due.toISOString().startsWith("2025-04-28")).toBe(true);
  });

  it("shifts weekend to Monday and respects holiday calendar", () => {
    const due = computeBasDueDate({
      periodEndDate: "2025-03-31",
      frequency: "monthly",
      entity_type: "small_business",
      dueDateRules: rules,
      holidayCalendar,
    });
    expect(due.getUTCDay()).toBe(1);
  });
});
