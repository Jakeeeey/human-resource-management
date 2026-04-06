// src/modules/human-resource-management/attendance-report/todays-report/utils/oncall.ts

/**
 * Find the active oncall schedule for a user on a specific date.
 *
 * Relationship (confirmed from API data):
 *   oncall_list.user_id       → matches the user
 *   oncall_list.dept_sched_id → directly matches oncall_schedule.id
 *
 * So the join is simply:
 *   oncall_list.dept_sched_id === oncall_schedule.id
 */
export function getActiveOncall(
  userId: unknown,
  dateStr: string,
  oncallList: Record<string, unknown>[],
  oncallScheds: Record<string, unknown>[],
): Record<string, unknown> | null {
  const requestedDate = new Date(dateStr + 'T00:00:00');

  // Step 1: Find all oncall_list entries for this user
  const userEntries = oncallList.filter(
    (ol) => String(ol.user_id) === String(userId)
  );

  if (userEntries.length === 0) return null;

  // Step 2: Collect the oncall_schedule ids assigned to this user
  const assignedSchedIds = new Set(
    userEntries.map((ol) => String(ol.dept_sched_id))
  );

  // Step 3: Find the best matching oncall_schedule
  // - oncall_schedule.id must be in assignedSchedIds
  // - schedule must be active on the requested date (workdays check)
  // - if multiple match, pick the one with the latest schedule_date
  let active: Record<string, unknown> | null = null;
  let latestSchedDate = new Date(0);

  for (const sched of oncallScheds) {
    // Direct ID match: dept_sched_id → oncall_schedule.id
    if (!assignedSchedIds.has(String(sched.id))) continue;

    // Check if today falls on an active workday for this schedule
    if (!isDayActive(requestedDate, sched)) continue;

    // Pick the most recently started schedule (latest schedule_date wins)
    const schedDate = sched.schedule_date
      ? new Date(String(sched.schedule_date) + 'T00:00:00')
      : new Date(0);

    if (schedDate >= latestSchedDate) {
      latestSchedDate = schedDate;
      active = { ...sched, is_oncall: true };
    }
  }

  return active;
}

/**
 * Check if the requested date falls on an active workday for this schedule.
 * Uses `workdays` comma-separated string if available (e.g. "Monday,Tuesday,...").
 * Falls back to `working_days` count: 5=Mon–Fri, 6=Mon–Sat, 7=every day.
 */
function isDayActive(
  date: Date,
  sched: Record<string, unknown>,
): boolean {
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName   = DAY_NAMES[date.getDay()];

  if (sched.workdays && String(sched.workdays).trim() !== '') {
    const workdays = String(sched.workdays)
      .split(',')
      .map((d) => d.trim());
    return workdays.includes(dayName);
  }

  // Fallback to working_days count
  const workingDays = Number(sched.working_days ?? 5);
  const dayOfWeek   = date.getDay(); // 0=Sun, 6=Sat

  if (workingDays >= 7) return true;
  if (workingDays >= 6) return dayOfWeek !== 0;         // Mon–Sat
  return dayOfWeek !== 0 && dayOfWeek !== 6;            // Mon–Fri
}

/**
 * Extract schedule fields from either oncall or department schedule.
 * Oncall schedule takes priority when the user is on oncall.
 */
export function extractScheduleFields(
  oncallSched: Record<string, unknown> | null,
  deptSched: Record<string, unknown>,
): {
  work_start:    unknown;
  work_end:      unknown;
  lunch_start:   unknown;
  lunch_end:     unknown;
  break_start:   unknown;
  break_end:     unknown;
  grace_period:  unknown;
  working_days:  unknown;
  workdays_note: unknown;
  is_oncall:     boolean;
} {
  if (oncallSched) {
    return {
      work_start:    oncallSched.work_start    ?? null,
      work_end:      oncallSched.work_end      ?? null,
      lunch_start:   oncallSched.lunch_start   ?? deptSched.lunch_start  ?? null,
      lunch_end:     oncallSched.lunch_end     ?? deptSched.lunch_end    ?? null,
      break_start:   oncallSched.break_start   ?? deptSched.break_start  ?? null,
      break_end:     oncallSched.break_end     ?? deptSched.break_end    ?? null,
      grace_period:  oncallSched.grace_period  ?? deptSched.grace_period ?? 5,
      working_days:  oncallSched.working_days  ?? deptSched.working_days ?? null,
      workdays_note: oncallSched.workdays      ?? deptSched.workdays_note ?? null,
      is_oncall:     true,
    };
  }

  return {
    work_start:    deptSched.work_start    ?? null,
    work_end:      deptSched.work_end      ?? null,
    lunch_start:   deptSched.lunch_start   ?? null,
    lunch_end:     deptSched.lunch_end     ?? null,
    break_start:   deptSched.break_start   ?? null,
    break_end:     deptSched.break_end     ?? null,
    grace_period:  deptSched.grace_period  ?? 5,
    working_days:  deptSched.working_days  ?? null,
    workdays_note: deptSched.workdays_note ?? null,
    is_oncall:     false,
  };
}