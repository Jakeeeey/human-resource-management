// src/app/api/hrm/attendance-report/employee-report/history/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getActiveOncall, extractScheduleFields } from '../../../../../../modules/human-resource-management/workforce/attendance-report/employee-report/utils/oncall';

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

function toDateOnly(val: unknown): string {
  if (!val) return '';
  return String(val).slice(0, 10);
}

async function fetchCollection(
  collection: string,
  params: Record<string, string>,
) {
  const query = new URLSearchParams({ limit: '-1', ...params });
  const url   = `${DIRECTUS_BASE}/items/${collection}?${query}`;

  console.log(`[HRM/EmployeeHistory] GET ${url}`);
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type':  'application/json',
      'Accept':        'application/json',
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

// ── Time helpers ──────────────────────────────────────────────────────────────

/**
 * Extract HH:MM from a full datetime string or plain HH:MM / HH:MM:SS.
 * Directus returns time fields as "2026-02-25T09:07:00" or "09:07:00" —
 * both forms need to be normalised before arithmetic.
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
 * Normalises full datetime strings to HH:MM before comparing.
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
 * Normalises full datetime strings to HH:MM before comparing.
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

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!DIRECTUS_BASE || !DIRECTUS_TOKEN) {
    console.error('[HRM/EmployeeHistory] Missing NEXT_PUBLIC_API_BASE_URL or DIRECTUS_STATIC_TOKEN');
    return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const from   = searchParams.get('from');
  const to     = searchParams.get('to');

  if (!userId) return NextResponse.json({ ok: false, message: 'Missing userId' }, { status: 400 });

  try {
    const logParams: Record<string, string> = {
      'filter[user_id][_eq]': userId,
      sort: '-log_date',
    };
    if (from) logParams['filter[log_date][_gte]'] = from;
    if (to)   logParams['filter[log_date][_lte]'] = to;

    console.log('[HRM/EmployeeHistory] Starting fetch with params:', logParams);

    const [logsRes, userRes, deptsRes, schedRes, oncallListRes, oncallSchedRes] = await Promise.all([
      fetchCollection('attendance_log', { ...logParams, fields: '*' }),
      fetchCollection('user', {
        'filter[user_id][_eq]': userId,
        limit: '1',
        fields: 'user_id,user_fname,user_lname,user_email,user_position,user_image,user_department',
      }),
      fetchCollection('department', {
        fields: 'department_id,department_name',
      }),
      fetchCollection('department_schedule', {
        fields: 'department_id,work_start,work_end,lunch_start,lunch_end,break_start,break_end,working_days,workdays_note,grace_period',
      }),
      fetchCollection('oncall_list', {
        'filter[user_id][_eq]': userId,
      }),
      fetchCollection('oncall_schedule', { fields: '*' }),
    ]);

    const rawUser      = (userRes.data ?? [])[0] ?? {};
    const depts        = deptsRes.data   ?? [];
    const scheds       = schedRes.data   ?? [];
    const oncallList:   Record<string, unknown>[] = oncallListRes.data  ?? [];
    const oncallScheds: Record<string, unknown>[] = oncallSchedRes.data ?? [];

    console.log(
      `[HRM/EmployeeHistory] userId=${userId} logs=${(logsRes.data ?? []).length}`,
      `depts=${depts.length} scheds=${scheds.length}`,
    );

    const deptMap   = new Map(depts.map((d: Record<string, unknown>) => [d.department_id, d]));
    const schedMap  = new Map(scheds.map((s: Record<string, unknown>) => [s.department_id, s]));
    const dept      = deptMap.get(rawUser.user_department)  ?? {};
    const deptSched = schedMap.get(rawUser.user_department) ?? {};

    const deptSchedFields = extractScheduleFields(null, deptSched as Record<string, unknown>);

    const employee = {
      user_id:         rawUser.user_id,
      user_fname:      rawUser.user_fname,
      user_lname:      rawUser.user_lname,
      user_email:      rawUser.user_email,
      user_position:   rawUser.user_position,
      user_image:      rawUser.user_image ?? null,
      department_id:   rawUser.user_department,
      department_name: (dept as Record<string, unknown>).department_name ?? '—',
      work_start:      deptSchedFields.work_start    ?? null,
      work_end:        deptSchedFields.work_end      ?? null,
      lunch_start:     deptSchedFields.lunch_start   ?? null,
      lunch_end:       deptSchedFields.lunch_end     ?? null,
      break_start:     deptSchedFields.break_start   ?? null,
      break_end:       deptSchedFields.break_end     ?? null,
      working_days:    deptSchedFields.working_days  ?? 5,
      workdays_note:   deptSchedFields.workdays_note ?? null,
      grace_period:    deptSchedFields.grace_period  ?? 5,
    };

    const logsMap = new Map(
      (logsRes.data ?? []).map((log: Record<string, unknown>) => [
        toDateOnly(log.log_date),
        log,
      ])
    );

    const filledLogs: Record<string, unknown>[] = [];

    if (from && to) {
      const cursor = new Date(from + 'T00:00:00');
      const end    = new Date(to   + 'T00:00:00');

      while (cursor <= end) {
        const dateStr = toLocalYMD(cursor);
        const logObj  = logsMap.get(dateStr) as Record<string, unknown> | undefined;
        let log: Record<string, unknown>;
        let isRealLog = false;

        if (logObj) {
          isRealLog = true;
          const exemptStatuses = ['Rest Day', 'Absent', 'Leave', 'Holiday'];
          const rawStatus  = String(logObj.status ?? '');
          const hasTimeIn  = !!(logObj.time_in);
          const hasTimeOut = !!(logObj.time_out);

          log = {
            ...logObj,
            approval_status: logObj.approve_status,
            directus_id: logObj.log_id ?? null,
            status: (!hasTimeIn && !hasTimeOut && !exemptStatuses.includes(rawStatus))
              ? 'Incomplete'
              : rawStatus,
          };
        } else {
          isRealLog = false;
          const restDay = isRestDay(dateStr, String(employee.department_name));
          log = {
            log_id:          -1,
            directus_id:     null,
            user_id:         employee.user_id,
            department_id:   employee.department_id,
            log_date:        dateStr,
            time_in:         null,
            lunch_start:     null,
            lunch_end:       null,
            break_start:     null,
            break_end:       null,
            time_out:        null,
            image_time_in:   null,
            image_time_out:  null,
            status:          restDay ? 'Rest Day' : 'Absent',
            created_at:      null,
            updated_at:      null,
            approval_status: '',
          };
        }

        const oncallSched = getActiveOncall(
          Number(userId),
          dateStr,
          oncallList,
          oncallScheds,
        );

        const schedFields = extractScheduleFields(
          oncallSched as Record<string, unknown> | null,
          deptSched as Record<string, unknown>,
        );

        const enrichedLog: Record<string, unknown> = {
          ...log,
          directus_id:   log.directus_id ?? null,
          grace_period:  schedFields.grace_period,
          working_days:  schedFields.working_days,
          workdays_note: schedFields.workdays_note,
          is_oncall:     schedFields.is_oncall,
        };

        if (schedFields.is_oncall) {
          enrichedLog.work_start         = null;
          enrichedLog.work_end           = null;
          enrichedLog.oncall_work_start  = schedFields.work_start;
          enrichedLog.oncall_work_end    = schedFields.work_end;
          enrichedLog.oncall_lunch_start = schedFields.lunch_start;
          enrichedLog.oncall_lunch_end   = schedFields.lunch_end;
          enrichedLog.oncall_break_start = schedFields.break_start;
          enrichedLog.oncall_break_end   = schedFields.break_end;
          // ✅ Fixed: was "lateLate(...)" / "lateOvertime(...)" — correct names are late / overtime
          enrichedLog.late     = calculateLate(log.time_in as string | null, schedFields.work_start as string | null, schedFields.grace_period as number);
          enrichedLog.overtime = calculateOvertime(log.time_out as string | null, schedFields.work_end as string | null);
        } else {
          enrichedLog.work_start         = schedFields.work_start;
          enrichedLog.work_end           = schedFields.work_end;
          if (!isRealLog) {
            enrichedLog.lunch_start      = null;
            enrichedLog.lunch_end        = null;
            enrichedLog.break_start      = null;
            enrichedLog.break_end        = null;
          }
          enrichedLog.oncall_work_start  = null;
          enrichedLog.oncall_work_end    = null;
          enrichedLog.oncall_lunch_start = null;
          enrichedLog.oncall_lunch_end   = null;
          enrichedLog.oncall_break_start = null;
          enrichedLog.oncall_break_end   = null;
          // ✅ Fixed: was "lateLate(...)" / "lateOvertime(...)" — correct names are late / overtime
          enrichedLog.late     = calculateLate(log.time_in as string | null, schedFields.work_start as string | null, schedFields.grace_period as number);
          enrichedLog.overtime = calculateOvertime(log.time_out as string | null, schedFields.work_end as string | null);
        }

        filledLogs.push(enrichedLog);
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      filledLogs.push(...(logsRes.data ?? []));
    }

    return NextResponse.json({ employee, logs: filledLogs });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[HRM/EmployeeHistory]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}