// src/app/api/hrm/attendance-report/todays-report/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getActiveOncall, extractScheduleFields } from '../../../../../modules/human-resource-management/workforce/attendance-report/todays-report/utils/oncall';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIRECTUS_BASE = 'http://192.168.0.143:9874';
const COOKIE_NAME   = 'vos_access_token';
const AUTH_DISABLED = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true';

async function fetchCollection(
  collection: string,
  params: Record<string, string>,
  sessionToken: string | undefined,
) {
  const query = new URLSearchParams({ limit: '-1', ...params });
  const url   = `${DIRECTUS_BASE}/api/items/${collection}?${query}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (sessionToken) {
    headers['Cookie'] = `${COOKIE_NAME}=${sessionToken}`;
  }

  console.log(`[HRM] GET ${url}`);
  const res = await fetch(url, { method: 'GET', headers, cache: 'no-store' });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${collection} → ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/** Format a Date to YYYY-MM-DD using LOCAL time — avoids UTC timezone shift. */
function toLocalYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Departments with BOTH Saturday AND Sunday as rest days.
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
    return NextResponse.json(
      { ok: false, message: 'Unauthorized: Missing access token' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  // Use local date to avoid UTC shift in Philippines (UTC+8)
  const date = searchParams.get('date') ?? toLocalYMD(new Date());
  console.log('[HRM/Attendance] Date:', date);

  try {
    const [
      attendanceRes,
      usersRes,
      deptsRes,
      schedRes,
      oncallListRes,
      oncallSchedRes,
    ] = await Promise.all([
      fetchCollection('attendance_log',      { 'filter[log_date][_eq]': date }, sessionToken),
      fetchCollection('user',                {}, sessionToken),
      fetchCollection('department',          {}, sessionToken),
      fetchCollection('department_schedule', {
        'fields': 'schedule_id,department_id,work_start,work_end,lunch_start,lunch_end,break_start,break_end,grace_period,working_days,workdays_note',
      }, sessionToken),
      fetchCollection('oncall_list',         {}, sessionToken),
      fetchCollection('oncall_schedule',     {
        'fields': 'id,department_id,group,working_days,work_start,work_end,lunch_start,lunch_end,break_start,break_end,workdays,grace_period,schedule_date',
      }, sessionToken),
    ]);

    const logs:         Record<string, unknown>[] = attendanceRes.data  ?? [];
    const users:        Record<string, unknown>[] = usersRes.data       ?? [];
    const depts:        Record<string, unknown>[] = deptsRes.data       ?? [];
    const scheds:       Record<string, unknown>[] = schedRes.data       ?? [];
    const oncallList:   Record<string, unknown>[] = oncallListRes.data  ?? [];
    const oncallScheds: Record<string, unknown>[] = oncallSchedRes.data ?? [];

    console.log('[oncall-list raw]', JSON.stringify(oncallList.slice(0, 5)));
console.log('[oncall-sched raw]', JSON.stringify(oncallScheds.slice(0, 3)));

    console.log(`[HRM/Attendance] logs=${logs.length} users=${users.length} depts=${depts.length} scheds=${scheds.length}`);

    // ── Build lookup maps ─────────────────────────────────────────────────
    const userMap  = new Map(users.map((u) => [u.user_id,       u]));
    const deptMap  = new Map(depts.map((d) => [d.department_id, d]));
    const schedMap = new Map(scheds.map((s) => [s.department_id, s]));

    // ── Helper to build a merged record from log + user data ──────────────
    function buildRecord(
      log: Record<string, unknown>,
      userId: unknown,
    ): Record<string, unknown> {
      const user        = userMap.get(userId)              ?? {};
      const dept        = deptMap.get(log.department_id)   ?? {};
      const deptSched   = schedMap.get(log.department_id)  ?? {};
      const oncallSched = getActiveOncall(userId, date, oncallList, oncallScheds);

      const schedFields = extractScheduleFields(oncallSched, deptSched as Record<string, unknown>);

      // ── Oncall debug log ──────────────────────────────────────────────
      console.log(`[oncall-check] user=${userId} date=${date}`, {
        matched: oncallSched ? `schedule_id=${oncallSched.id} group=${oncallSched.group}` : 'none',
        is_oncall: schedFields.is_oncall,
      });

      const record: Record<string, unknown> = {
        log_id:          log.log_id,
        user_id:         userId,
        department_id:   log.department_id,
        log_date:        log.log_date,
        time_in:         log.time_in         ?? null,
        time_out:        log.time_out        ?? null,
        lunch_start:     log.lunch_start     ?? schedFields.lunch_start,
        lunch_end:       log.lunch_end       ?? schedFields.lunch_end,
        break_start:     log.break_start     ?? schedFields.break_start,
        break_end:       log.break_end       ?? schedFields.break_end,
        status:          log.status          ?? 'Absent',
        approval_status: log.approval_status ?? '',
        image_time_in:   log.image_time_in   ?? null,
        image_time_out:  log.image_time_out  ?? null,
        // user
        user_fname:      user.user_fname    ?? '—',
        user_lname:      user.user_lname    ?? '—',
        user_mname:      user.user_mname    ?? null,
        user_email:      user.user_email    ?? '—',
        user_position:   user.user_position ?? '—',
        user_image:      user.user_image    ?? null,
        // department
        department_name: (dept as Record<string, unknown>).department_name ?? '—',
        grace_period:    schedFields.grace_period,
        working_days:    schedFields.working_days,
        workdays_note:   schedFields.workdays_note,
        is_oncall:       schedFields.is_oncall,
      };

      // Set schedule fields with proper naming for hook compatibility
      if (schedFields.is_oncall) {
        // If user is on oncall, use oncall_ prefix for hook compatibility
        record.work_start   = null;
        record.work_end     = null;
        record.oncall_work_start   = schedFields.work_start;
        record.oncall_work_end     = schedFields.work_end;
        record.oncall_lunch_start  = schedFields.lunch_start;
        record.oncall_lunch_end    = schedFields.lunch_end;
        record.oncall_break_start  = schedFields.break_start;
        record.oncall_break_end    = schedFields.break_end;
      } else {
        // Regular department schedule
        record.work_start   = schedFields.work_start;
        record.work_end     = schedFields.work_end;
        record.oncall_work_start   = null;
        record.oncall_work_end     = null;
        record.oncall_lunch_start  = null;
        record.oncall_lunch_end    = null;
        record.oncall_break_start  = null;
        record.oncall_break_end    = null;
      }

      return record;
    }

    // ── Merge existing logs ───────────────────────────────────────────────
    const loggedUserIds = new Set(logs.map((l) => l.user_id));
    const merged: Record<string, unknown>[] = logs.map((log) =>
      buildRecord(log, log.user_id)
    );

    // ── Synthesize Absent / Rest Day rows for users with no log today ─────
    for (const user of users) {
      if (loggedUserIds.has(user.user_id)) continue; // already has a log

      const dept      = deptMap.get(user.user_department)  ?? {};
      const deptSched = schedMap.get(user.user_department) ?? {};
      const deptName  = String((dept as Record<string, unknown>).department_name ?? '');
      const restDay   = isRestDay(date, deptName);

      const oncallSched  = getActiveOncall(user.user_id, date, oncallList, oncallScheds);
      const schedFields  = extractScheduleFields(oncallSched, deptSched as Record<string, unknown>);

      // ── Oncall debug log (synthesized rows) ───────────────────────────
      console.log(`[oncall-check synth] user=${user.user_id} date=${date}`, {
        matched: oncallSched ? `schedule_id=${oncallSched.id} group=${oncallSched.group}` : 'none',
        is_oncall: schedFields.is_oncall,
      });

      const synthRecord: Record<string, unknown> = {
        log_id:          null,
        user_id:         user.user_id,
        department_id:   user.user_department,
        log_date:        date,
        time_in:         null,
        time_out:        null,
        status:          restDay ? 'Rest Day' : 'Absent',
        approval_status: '',
        image_time_in:   null,
        image_time_out:  null,
        // user
        user_fname:      user.user_fname    ?? '—',
        user_lname:      user.user_lname    ?? '—',
        user_mname:      user.user_mname    ?? null,
        user_email:      user.user_email    ?? '—',
        user_position:   user.user_position ?? '—',
        user_image:      user.user_image    ?? null,
        // department
        department_name: deptName || '—',
        grace_period:    schedFields.grace_period,
        working_days:    schedFields.working_days,
        workdays_note:   schedFields.workdays_note,
        is_oncall:       schedFields.is_oncall,
      };

      // Set schedule fields with proper naming for hook compatibility
      if (schedFields.is_oncall) {
        // If user is on oncall, use oncall_ prefix for hook compatibility
        synthRecord.work_start   = null;
        synthRecord.work_end     = null;
        synthRecord.oncall_work_start   = schedFields.work_start;
        synthRecord.oncall_work_end     = schedFields.work_end;
        synthRecord.oncall_lunch_start  = schedFields.lunch_start;
        synthRecord.oncall_lunch_end    = schedFields.lunch_end;
        synthRecord.oncall_break_start  = schedFields.break_start;
        synthRecord.oncall_break_end    = schedFields.break_end;
      } else {
        // Regular department schedule
        synthRecord.work_start   = schedFields.work_start;
        synthRecord.work_end     = schedFields.work_end;
        synthRecord.oncall_work_start   = null;
        synthRecord.oncall_work_end     = null;
        synthRecord.oncall_lunch_start  = null;
        synthRecord.oncall_lunch_end    = null;
        synthRecord.oncall_break_start  = null;
        synthRecord.oncall_break_end    = null;
      }

      merged.push(synthRecord);
    }

    return NextResponse.json({ data: merged });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[HRM/Attendance] Error:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}