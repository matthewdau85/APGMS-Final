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

function isWeekend(date: Date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function computeBasDueDate(options: {
  periodEndDate: string | Date;
  frequency: string;
  entity_type: string;
  dueDateRules: BasDueDateRule[];
  holidayCalendar?: HolidayCalendar;
}): Date {
  const { periodEndDate, frequency, entity_type, dueDateRules, holidayCalendar } = options;
  const rule = dueDateRules.find(
    (r) =>
      r.applies_to.entity_type === entity_type &&
      r.applies_to.frequency === frequency
  );
  if (!rule) {
    throw new Error(`No BAS rule for ${entity_type}/${frequency}`);
  }

  const baseDate =
    typeof periodEndDate === "string"
      ? new Date(periodEndDate)
      : new Date(periodEndDate);
  const due = new Date(Date.UTC(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth() + rule.due_month_offset,
    rule.due_day,
  ));
  const calendar = holidayCalendar ?? defaultHolidayCalendar;
  while (isWeekend(due) || calendar.isHoliday(due)) {
    due.setUTCDate(due.getUTCDate() + 1);
  }
  return due;
}
