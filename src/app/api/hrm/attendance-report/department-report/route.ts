// src/app/api/hrm/attendance-report/department-report/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getActiveOncall, extractScheduleFields } from '../../../../../modules/human-resource-management/workforce/attendance-report/department-report/utils/oncall';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIRECTUS_BASE  = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function toLocalYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DOUBLE_RESTDAY_DEPTS = [
  'technical support-afternoon shift',
  'hr department',
  'development-ojt',
  'techsupport-ojt',
];

function isRestDay(dateStr: string, departmentName: string): boolean {
  const day  = new Date(dateStr + 'T00:00:00').getDay();
  const dept = (departmentName ?? '').toLowerCase().trim().replace(/\s*-\s*/g, '-');
  if (DOUBLE_RESTDAY_DEPTS.includes(dept)) return day === 0 || day === 6;
  return day === 0;
}

async function fetchCollection(collection: string, params: Record<string, string>) {
  const query = new URLSearchParams({ limit: '-1', ...params });
  const url   = `${DIRECTUS_BASE}/items/${collection}?${query}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${collection} → ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// ── Time helpers (same pattern as employee-report/history/route.ts) ────────────

/**
 * Extract HH:MM from a full datetime string or plain HH:MM / HH:MM:SS.
 * Directus returns time fields as "2026-03-31T09:07:00" or "09:07:00" —
 * normalise to HH:MM before any arithmetic.
 */
function extractTime(dt: string | null | undefined): string | null {
  if (!dt) return null;
  if (dt.includes('T')) return dt.split('T')[1].slice(0, 5);
  if (dt.includes(' ') && dt.includes('-')) return dt.split(' ')[1].slice(0, 5);
  return dt.slice(0, 5);
}

function timeToMins(t: string | null): number {
  if (!t) return 0;
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

/**
 * Returns how many minutes after (work_start + grace_period) the employee clocked in.
 * Handles full ISO datetime strings by extracting the time component first.
 */
function calculateLate(
  timeIn:      string | null,
  workStart:   string | null,
  gracePeriod: number = 5,
): number {
  const ti = extractTime(timeIn);
  const ws = extractTime(workStart);
  if (!ti || !ws) return 0;
  return Math.max(0, timeToMins(ti) - (timeToMins(ws) + gracePeriod));
}

/**
 * Returns how many minutes after work_end the employee clocked out.
 * Handles full ISO datetime strings by extracting the time component first.
 */
function calculateOvertime(
  timeOut: string | null,
  workEnd: string | null,
): number {
  const to = extractTime(timeOut);
  const we = extractTime(workEnd);
  if (!to || !we) return 0;
  return Math.max(0, timeToMins(to) - timeToMins(we));
}

/**
 * Compute total work minutes between time_in and time_out,
 * deducting lunch break if both lunch_start and lunch_end are present.
 * Capped at 480 mins (8h) — excess is overtime.
 */
function calculateWorkMins(
  timeIn:     string | null,
  timeOut:    string | null,
  lunchStart: string | null,
  lunchEnd:   string | null,
): number {
  const ti = extractTime(timeIn);
  const to = extractTime(timeOut);
  if (!ti || !to) return 0;
  let total = timeToMins(to) - timeToMins(ti);
  const ls = extractTime(lunchStart);
  const le = extractTime(lunchEnd);
  if (ls && le) total -= (timeToMins(le) - timeToMins(ls));
  return Math.min(Math.max(0, total), 480);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!DIRECTUS_BASE || !DIRECTUS_TOKEN) {
    return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const deptId = searchParams.get('deptId');
  const from   = searchParams.get('from') ?? toLocalYMD(new Date());
  const to     = searchParams.get('to')   ?? from;

  try {
    // 1. Fetch all metadata in parallel
    const [deptsRes, schedRes, oncallListRes, oncallSchedRes] = await Promise.all([
      fetchCollection('department', { fields: 'department_id,department_name' }),
      fetchCollection('department_schedule', { fields: '*' }),
      fetchCollection('oncall_list', {}),
      fetchCollection('oncall_schedule', { fields: '*' }),
    ]);

    const depts:       Record<string, unknown>[] = deptsRes.data      ?? [];
    const scheds:      Record<string, unknown>[] = schedRes.data      ?? [];
    const oncallList:  Record<string, unknown>[] = oncallListRes.data  ?? [];
    const oncallScheds:Record<string, unknown>[] = oncallSchedRes.data ?? [];

    const deptMap  = new Map(depts.map((d) => [d.department_id, d]));
    const schedMap = new Map(scheds.map((s) => [s.department_id, s]));

    // 2. Fetch users
    const userParams: Record<string, string> = {
      fields: 'user_id,user_fname,user_lname,user_position,user_image,user_department,is_deleted',
    };
    if (deptId) userParams['filter[user_department][_eq]'] = deptId;

    const usersRes = await fetchCollection('user', userParams);
    const allUsers = (usersRes.data ?? []).filter((u: Record<string, unknown>) => {
      const deleted = (u.is_deleted as { data?: number[] } | null)?.data
        ? (u.is_deleted as { data: number[] }).data[0] === 1
        : !!u.is_deleted;
      return !deleted;
    });

    // 3. Fetch attendance logs for the date range
    const logParams: Record<string, string> = {
      'filter[log_date][_gte]': from,
      'filter[log_date][_lte]': to,
      fields: '*',
    };
    if (deptId) logParams['filter[department_id][_eq]'] = deptId;

    const logsRes = await fetchCollection('attendance_log', logParams);
    const logs:    Record<string, unknown>[] = logsRes.data ?? [];

    // Key: "userId-YYYY-MM-DD"
    const logMap = new Map<string, Record<string, unknown>>();
    logs.forEach((l) => {
      const uid     = typeof l.user_id === 'object'
        ? (l.user_id as Record<string, unknown>).user_id
        : l.user_id;
      const dateKey = String(l.log_date).slice(0, 10);
      logMap.set(`${uid}-${dateKey}`, l);
    });

    // 4. Build date range
    const dates: string[] = [];
    const cursor  = new Date(from + 'T00:00:00');
    const endDate = new Date(to   + 'T00:00:00');
    while (cursor <= endDate) {
      dates.push(toLocalYMD(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    // 5. Build merged output — one row per user per date
    const merged = allUsers.flatMap((user: Record<string, unknown>) => {
      const deptInfo  = (deptMap.get(user.user_department)  ?? {}) as Record<string, unknown>;
      const schedInfo = (schedMap.get(user.user_department) ?? {}) as Record<string, unknown>;

      return dates.map((date) => {
        const log = logMap.get(`${user.user_id}-${date}`);

        const oncallSched = getActiveOncall(user.user_id, date, oncallList, oncallScheds);
        const schedFields = extractScheduleFields(oncallSched, schedInfo);

        // Effective schedule times (oncall overrides regular)
        const effectiveWorkStart = (schedFields.work_start  ?? null) as string | null;
        const effectiveWorkEnd   = (schedFields.work_end    ?? null) as string | null;
        const effectiveGrace     = (schedFields.grace_period ?? 5)   as number;

        // Punch times from the actual log
        const timeIn     = (log?.time_in     ?? null) as string | null;
        const timeOut    = (log?.time_out    ?? null) as string | null;
        const lunchStart = (log?.lunch_start ?? schedFields.lunch_start ?? null) as string | null;
        const lunchEnd   = (log?.lunch_end   ?? schedFields.lunch_end   ?? null) as string | null;
        const breakStart = (log?.break_start ?? schedFields.break_start ?? null) as string | null;
        const breakEnd   = (log?.break_end   ?? schedFields.break_end   ?? null) as string | null;

        // Status
        let status = 'Absent';
        if (log) {
          const exemptStatuses = ['Rest Day', 'Absent', 'Leave', 'Holiday'];
          const rawStatus  = String(log.status ?? '');
          const hasTimeIn  = !!log.time_in;
          const hasTimeOut = !!log.time_out;
          status = (!hasTimeIn && !hasTimeOut && !exemptStatuses.includes(rawStatus))
            ? 'Incomplete'
            : rawStatus || 'Present';
        } else if (isRestDay(date, String(deptInfo.department_name ?? ''))) {
          status = 'Rest Day';
        }

        // ── Computed metrics ──────────────────────────────────────────────────
        const late     = calculateLate(timeIn, effectiveWorkStart, effectiveGrace);
        const overtime = calculateOvertime(timeOut, effectiveWorkEnd);
        const workMins = calculateWorkMins(timeIn, timeOut, lunchStart, lunchEnd);

        // Punctuality is derived from computed `late`, NOT from Directus\'s stored
        // status field. Directus stores whatever the device reported at clock-in
        // time, which may not match the server-side grace period calculation.
        // e.g. time_in=09:38, work_start=08:30, grace=5 → late=63 → "Late",
        // even if Directus stored status="On Time".
        const punctuality = !timeIn
          ? null
          : late > 0
            ? 'Late'
            : 'On Time';

        return {
          log_id:          log?.log_id          ?? null,
          user_id:         user.user_id,
          user_fname:      user.user_fname,
          user_lname:      user.user_lname,
          user_position:   user.user_position   ?? '—',
          user_image:      user.user_image       ?? null,
          log_date:        date,
          time_in:         extractTime(timeIn),
          time_out:        extractTime(timeOut),
          lunch_start:     extractTime(lunchStart),
          lunch_end:       extractTime(lunchEnd),
          break_start:     extractTime(breakStart),
          break_end:       extractTime(breakEnd),
          status,
          department_name: deptInfo.department_name ?? '—',
          work_start:      effectiveWorkStart,
          work_end:        effectiveWorkEnd,
          grace_period:    effectiveGrace,
          // ✅ Computed: late, overtime, work_mins, punctuality
          late,
          overtime,
          work_mins:       workMins,
          punctuality,
          is_oncall:       !!oncallSched,
          oncall_work_start:  oncallSched ? schedFields.work_start  : null,
          oncall_work_end:    oncallSched ? schedFields.work_end    : null,
          oncall_lunch_start: oncallSched ? schedFields.lunch_start : null,
          oncall_lunch_end:   oncallSched ? schedFields.lunch_end   : null,
          oncall_break_start: oncallSched ? schedFields.break_start : null,
          oncall_break_end:   oncallSched ? schedFields.break_end   : null,
        };
      });
    });

    return NextResponse.json({ departments: depts, logs: merged });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[HRM/DeptReport] Error:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}