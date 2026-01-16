// packages/domain-policy/src/au-tax/bas-due-date.ts
//
// BAS due date calculator (simplified).
//
// This supports a rule table approach:
// - Match a rule by entity_type + frequency
// - Compute due date as (period end + month offset) with a fixed day-of-month
// - Shift forward for weekends and holidays (calendar callback)
//
// ATO-grade gaps:
// - Does not model BAS agent lodgment program, deferrals, or quarterly variations.
// - Does not model annual, GST-only, or non-standard periods.

export interface BasDueDateRule {
  applies_to: { entity_type: string; frequency: string };
  due_day: number;
  due_month_offset: number;
  notes?: string;
}

export interface HolidayCalendar {
  isHoliday(date: Date): boolean;
}

const defaultHolidayCalendar: HolidayCalendar = {
  isHoliday: () => false,
};

function parseIsoDateOnlyToUtcDate(value: string): Date {
  // Accept YYYY-MM-DD only.
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
  if (!m) throw new Error(`Invalid ISO date (expected YYYY-MM-DD): ${value}`);
  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12
  const day = Number(m[3]);
  return new Date(Date.UTC(year, month - 1, day));
}

function daysInUtcMonth(year: number, month0: number): number {
  // month0: 0-11
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

function isWeekend(date: Date): boolean {
  const d = date.getUTCDay(); // 0=Sun, 6=Sat
  return d === 0 || d === 6;
}

export interface ComputeBasDueDateInput {
  periodEndDate: string | Date;
  frequency: string;
  entity_type: string;
  dueDateRules: ReadonlyArray<BasDueDateRule>;
  holidayCalendar?: HolidayCalendar;
}

export function computeBasDueDate(input: ComputeBasDueDateInput): Date {
  const {
    periodEndDate,
    frequency,
    entity_type,
    dueDateRules,
    holidayCalendar,
  } = input;

  const rule = dueDateRules.find(
    (r) =>
      r.applies_to.entity_type === entity_type &&
      r.applies_to.frequency === frequency,
  );
  if (!rule) {
    throw new Error(
      `BAS_DUE_DATE_RULE_MISSING: entity_type=${entity_type} frequency=${frequency}`,
    );
  }

  const baseDate =
    typeof periodEndDate === "string"
      ? parseIsoDateOnlyToUtcDate(periodEndDate)
      : new Date(Date.UTC(
          periodEndDate.getUTCFullYear(),
          periodEndDate.getUTCMonth(),
          periodEndDate.getUTCDate(),
        ));

  const targetYear = baseDate.getUTCFullYear();
  const targetMonth0 = baseDate.getUTCMonth() + rule.due_month_offset;

  // Construct the target due date in UTC.
  const year = targetYear + Math.floor(targetMonth0 / 12);
  const month0 = ((targetMonth0 % 12) + 12) % 12;

  const dim = daysInUtcMonth(year, month0);
  const day = Math.min(Math.max(rule.due_day, 1), dim);

  const due = new Date(Date.UTC(year, month0, day));

  const calendar = holidayCalendar ?? defaultHolidayCalendar;
  while (isWeekend(due) || calendar.isHoliday(due)) {
    due.setUTCDate(due.getUTCDate() + 1);
  }

  return due;
}
