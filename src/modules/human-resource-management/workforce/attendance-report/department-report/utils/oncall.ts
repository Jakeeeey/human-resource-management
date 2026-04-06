// src/app/api/hrm/utils/oncall.ts

/**
 * Find the active oncall schedule for a user on a specific date.
 * Prioritizes oncall schedule over department schedule if user is on oncall.
 */
export function getActiveOncall(
  userId: unknown,
  dateStr: string,
  oncallList: Record<string, unknown>[],
  oncallScheds: Record<string, unknown>[],
): Record<string, unknown> | null {
  const requestedDate = new Date(dateStr + 'T00:00:00');
  let active: Record<string, unknown> | null = null;
  let latestSchedDate = new Date(0);

  oncallList
    .filter((ol) => ol.user_id === userId)
    .forEach((ol) => {
      const sched = oncallScheds.find((os) => os.id === ol.dept_sched_id);
      if (!sched) return;

      // No schedule_date = permanent oncall, always active
      if (!sched.schedule_date) {
        if (!active) {
          active = { ...sched, is_oncall: true };
        }
        return;
      }

      const schedDate = new Date(String(sched.schedule_date) + 'T00:00:00');
      const workingDays = Number(sched.working_days ?? 1);
      const endDate = new Date(schedDate);
      endDate.setDate(endDate.getDate() + workingDays - 1);

      if (requestedDate >= schedDate && requestedDate <= endDate) {
        if (schedDate > latestSchedDate) {
          latestSchedDate = schedDate;
          active = { ...sched, is_oncall: true };
        }
      }
    });

  return active;
}

/**
 * Extract schedule fields from either oncall or department schedule
 * Oncall schedule takes priority if user is on oncall
 */
export function extractScheduleFields(
  oncallSched: Record<string, unknown> | null,
  deptSched: Record<string, unknown>,
): {
  work_start: unknown;
  work_end: unknown;
  lunch_start: unknown;
  lunch_end: unknown;
  break_start: unknown;
  break_end: unknown;
  grace_period: unknown;
  working_days: unknown;
  workdays_note: unknown;
  is_oncall: boolean;
} {
  const schedule = oncallSched || deptSched;
  
  return {
    work_start: schedule?.work_start ?? null,
    work_end: schedule?.work_end ?? null,
    lunch_start: schedule?.lunch_start ?? null,
    lunch_end: schedule?.lunch_end ?? null,
    break_start: schedule?.break_start ?? null,
    break_end: schedule?.break_end ?? null,
    grace_period: schedule?.grace_period ?? 5,
    working_days: schedule?.working_days ?? null,
    workdays_note: schedule?.workdays ?? schedule?.workdays_note ?? null,
    is_oncall: !!oncallSched,
  };
}
