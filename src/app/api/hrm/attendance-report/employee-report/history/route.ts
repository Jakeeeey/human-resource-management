// src/app/api/hrm/attendance-report/employee-report/history/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getActiveOncall, extractScheduleFields } from '../../../../../../modules/human-resource-management/workforce/attendance-report/todays-report/utils/oncall';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIRECTUS_BASE = 'http://192.168.0.143:9874';
const COOKIE_NAME   = 'vos_access_token';
const AUTH_DISABLED = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true';

/** Format a Date to YYYY-MM-DD using LOCAL time — avoids UTC timezone shift (e.g. UTC+8). */
function toLocalYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Normalize any date string to YYYY-MM-DD.
 * Handles: "2026-02-25", "2026-02-25T00:00:00", "2026-02-25 00:00:00"
 */
function toDateOnly(val: unknown): string {
  if (!val) return '';
  return String(val).slice(0, 10);
}

async function fetchCollection(path: string, token: string | undefined) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Cookie'] = `${COOKIE_NAME}=${token}`;
  const res = await fetch(`${DIRECTUS_BASE}/api/items/${path}`, { headers, cache: 'no-store' });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
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

export async function GET(request: NextRequest) {
  const cookieStore  = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!AUTH_DISABLED && !sessionToken) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const from   = searchParams.get('from');
  const to     = searchParams.get('to');

  if (!userId) return NextResponse.json({ ok: false, message: 'Missing userId' }, { status: 400 });

  try {
    const logsPath = `attendance_log?filter[user_id][_eq]=${userId}${from ? `&filter[log_date][_gte]=${from}` : ''}${to ? `&filter[log_date][_lte]=${to}` : ''}&limit=-1&sort=-log_date`;
    const userPath = `user?filter[user_id][_eq]=${userId}&limit=1&fields=user_id,user_fname,user_lname,user_email,user_position,user_image,user_department`;

    const [logsRes, userRes, deptsRes, schedRes, oncallListRes, oncallSchedRes] = await Promise.all([
      fetchCollection(logsPath, sessionToken),
      fetchCollection(userPath, sessionToken),
      fetchCollection('department?limit=-1&fields=department_id,department_name', sessionToken),
      fetchCollection('department_schedule?limit=-1&fields=department_id,work_start,work_end,lunch_start,lunch_end,break_start,break_end,working_days,workdays_note,grace_period', sessionToken),
      fetchCollection(`oncall_list?filter[user_id][_eq]=${userId}&limit=-1`, sessionToken),
      fetchCollection('oncall_schedule?limit=-1&fields=id,department_id,group,working_days,work_start,work_end,lunch_start,lunch_end,break_start,break_end,workdays,grace_period,schedule_date', sessionToken),
    ]);

    const rawUser      = (userRes.data ?? [])[0] ?? {};
    const depts        = deptsRes.data   ?? [];
    const scheds       = schedRes.data   ?? [];
    const oncallList:   Record<string, unknown>[] = oncallListRes.data  ?? [];
    const oncallScheds: Record<string, unknown>[] = oncallSchedRes.data ?? [];

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
      work_start:      deptSchedFields.work_start   ?? null,
      work_end:        deptSchedFields.work_end     ?? null,
      lunch_start:     deptSchedFields.lunch_start  ?? null,
      lunch_end:       deptSchedFields.lunch_end    ?? null,
      break_start:     deptSchedFields.break_start  ?? null,
      break_end:       deptSchedFields.break_end    ?? null,
      working_days:    deptSchedFields.working_days ?? 5,
      workdays_note:   deptSchedFields.workdays_note ?? null,
      grace_period:    deptSchedFields.grace_period  ?? 5,
    };

    // Normalize log_date to YYYY-MM-DD — Directus may return datetime strings
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
            // directus_id = Directus big PK used for geotag lookup
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
          // On-call: use oncall schedule for work hours calculation
          // Preserve real log punch times (time_in, lunch_start etc.) unchanged
          enrichedLog.work_start          = null;
          enrichedLog.work_end            = null;
          enrichedLog.oncall_work_start   = schedFields.work_start;
          enrichedLog.oncall_work_end     = schedFields.work_end;
          enrichedLog.oncall_lunch_start  = schedFields.lunch_start;
          enrichedLog.oncall_lunch_end    = schedFields.lunch_end;
          enrichedLog.oncall_break_start  = schedFields.break_start;
          enrichedLog.oncall_break_end    = schedFields.break_end;
        } else {
          // Regular schedule — ONLY set work_start/work_end from schedule
          // DO NOT overwrite lunch_start/lunch_end/break_start/break_end:
          // those come from the actual attendance log punch data (logObj).
          // Only synthesized rows (isRealLog=false) get null values which
          // we leave as-is since there's no punch data anyway.
          enrichedLog.work_start          = schedFields.work_start;
          enrichedLog.work_end            = schedFields.work_end;
          // For real logs: keep the spread logObj values (already in enrichedLog)
          // For synthesized rows: set to null (already null from log definition)
          if (!isRealLog) {
            enrichedLog.lunch_start       = null;
            enrichedLog.lunch_end         = null;
            enrichedLog.break_start       = null;
            enrichedLog.break_end         = null;
          }
          // If isRealLog: lunch_start/lunch_end/break_start/break_end are already
          // correctly set from ...logObj spread — do NOT touch them here
          enrichedLog.oncall_work_start   = null;
          enrichedLog.oncall_work_end     = null;
          enrichedLog.oncall_lunch_start  = null;
          enrichedLog.oncall_lunch_end    = null;
          enrichedLog.oncall_break_start  = null;
          enrichedLog.oncall_break_end    = null;
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