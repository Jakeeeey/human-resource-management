// src/app/api/hrm/attendance-report/todays-report/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getActiveOncall, extractScheduleFields } from '../../../../../modules/human-resource-management/workforce/attendance-report/todays-report/utils/oncall';

function isDeleted(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (val && typeof val === 'object') {
    const buf = val as { type?: string; data?: number[] };
    if (buf.type === 'Buffer' && Array.isArray(buf.data)) {
      return buf.data[0] === 1;
    }
  }
  return false;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIRECTUS_BASE  = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

async function fetchCollection(
  collection: string,
  params: Record<string, string>,
) {
  const query = new URLSearchParams({ limit: '-1', ...params });
  const url   = `${DIRECTUS_BASE}/items/${collection}?${query}`;

  console.log(`[HRM] GET ${url}`);
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
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

/** Format a Date to YYYY-MM-DD using LOCAL time — avoids UTC timezone shift. */
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

export async function GET(request: NextRequest) {
  if (!DIRECTUS_BASE || !DIRECTUS_TOKEN) {
    console.error('[HRM/Attendance] Missing NEXT_PUBLIC_API_BASE_URL or DIRECTUS_STATIC_TOKEN');
    return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
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
      fetchCollection('attendance_log', { 'filter[log_date][_eq]': date }),
      fetchCollection('user',                {}),
      fetchCollection('department',          {}),
      fetchCollection('department_schedule', {
        fields: 'schedule_id,department_id,work_start,work_end,lunch_start,lunch_end,break_start,break_end,grace_period,working_days,workdays_note',
      }),
      fetchCollection('oncall_list',         {}),
      fetchCollection('oncall_schedule',     {
        fields: 'id,department_id,group,working_days,work_start,work_end,lunch_start,lunch_end,break_start,break_end,workdays,grace_period,schedule_date',
      }),
    ]);

    const logs:         Record<string, unknown>[] = attendanceRes.data  ?? [];
    const users:        Record<string, unknown>[] = usersRes.data       ?? [];
    const depts:        Record<string, unknown>[] = deptsRes.data       ?? [];
    const scheds:       Record<string, unknown>[] = schedRes.data       ?? [];
    const oncallList:   Record<string, unknown>[] = oncallListRes.data  ?? [];
    const oncallScheds: Record<string, unknown>[] = oncallSchedRes.data ?? [];

    console.log(`[HRM/Attendance] logs=${logs.length} users=${users.length} depts=${depts.length} scheds=${scheds.length}`);

    // Filter out deleted users
    const filteredUsers = users.filter((u) => !isDeleted(u.is_deleted));
    const userMap  = new Map(filteredUsers.map((u) => [u.user_id, u]));
    const deptMap  = new Map(depts.map((d) => [d.department_id, d]));
    const schedMap = new Map(scheds.map((s) => [s.department_id, s]));

    function buildRecord(
      log: Record<string, unknown>,
      userId: unknown,
    ): Record<string, unknown> {
      const user        = userMap.get(userId)              ?? {};
      const dept        = deptMap.get(log.department_id)   ?? {};
      const deptSched   = schedMap.get(log.department_id)  ?? {};
      const oncallSched = getActiveOncall(userId, date, oncallList, oncallScheds);
      const schedFields = extractScheduleFields(oncallSched, deptSched as Record<string, unknown>);

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
        approval_status: log.approve_status ?? '',
        image_time_in:   log.image_time_in   ?? null,
        image_time_out:  log.image_time_out  ?? null,
        user_fname:      (user as Record<string, unknown>).user_fname    ?? '—',
        user_lname:      (user as Record<string, unknown>).user_lname    ?? '—',
        user_mname:      (user as Record<string, unknown>).user_mname    ?? null,
        user_email:      (user as Record<string, unknown>).user_email    ?? '—',
        user_position:   (user as Record<string, unknown>).user_position ?? '—',
        user_image:      (user as Record<string, unknown>).user_image    ?? null,
        department_name: (dept as Record<string, unknown>).department_name ?? '—',
        grace_period:    schedFields.grace_period,
        working_days:    schedFields.working_days,
        workdays_note:   schedFields.workdays_note,
        is_oncall:       schedFields.is_oncall,
      };

      if (schedFields.is_oncall) {
        record.work_start          = null;
        record.work_end            = null;
        record.oncall_work_start   = schedFields.work_start;
        record.oncall_work_end     = schedFields.work_end;
        record.oncall_lunch_start  = schedFields.lunch_start;
        record.oncall_lunch_end    = schedFields.lunch_end;
        record.oncall_break_start  = schedFields.break_start;
        record.oncall_break_end    = schedFields.break_end;
      } else {
        record.work_start          = schedFields.work_start;
        record.work_end            = schedFields.work_end;
        record.oncall_work_start   = null;
        record.oncall_work_end     = null;
        record.oncall_lunch_start  = null;
        record.oncall_lunch_end    = null;
        record.oncall_break_start  = null;
        record.oncall_break_end    = null;
      }

      return record;
    }

    const loggedUserIds = new Set(logs.map((l) => l.user_id));
    const merged: Record<string, unknown>[] = logs.map((log) =>
      buildRecord(log, log.user_id)
    );

    for (const user of filteredUsers) {
      if (loggedUserIds.has(user.user_id)) continue;

      const dept      = deptMap.get(user.user_department)  ?? {};
      const deptSched = schedMap.get(user.user_department) ?? {};
      const deptName  = String((dept as Record<string, unknown>).department_name ?? '');
      const restDay   = isRestDay(date, deptName);

      const oncallSched = getActiveOncall(user.user_id, date, oncallList, oncallScheds);
      const schedFields = extractScheduleFields(oncallSched, deptSched as Record<string, unknown>);

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
        user_fname:      user.user_fname    ?? '—',
        user_lname:      user.user_lname    ?? '—',
        user_mname:      user.user_mname    ?? null,
        user_email:      user.user_email    ?? '—',
        user_position:   user.user_position ?? '—',
        user_image:      user.user_image    ?? null,
        department_name: deptName || '—',
        grace_period:    schedFields.grace_period,
        working_days:    schedFields.working_days,
        workdays_note:   schedFields.workdays_note,
        is_oncall:       schedFields.is_oncall,
      };

      if (schedFields.is_oncall) {
        synthRecord.work_start          = null;
        synthRecord.work_end            = null;
        synthRecord.oncall_work_start   = schedFields.work_start;
        synthRecord.oncall_work_end     = schedFields.work_end;
        synthRecord.oncall_lunch_start  = schedFields.lunch_start;
        synthRecord.oncall_lunch_end    = schedFields.lunch_end;
        synthRecord.oncall_break_start  = schedFields.break_start;
        synthRecord.oncall_break_end    = schedFields.break_end;
      } else {
        synthRecord.work_start          = schedFields.work_start;
        synthRecord.work_end            = schedFields.work_end;
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