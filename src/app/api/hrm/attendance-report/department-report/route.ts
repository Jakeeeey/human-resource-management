// src/app/api/hrm/attendance-report/department-report/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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

// Departments with BOTH Saturday AND Sunday as rest days.
// All other departments only have Sunday as a rest day.
const DOUBLE_RESTDAY_DEPTS = [
  'technical support-afternoon shift',
  'hr department',
  'development-ojt',
  'techsupport-ojt',
];

function isRestDay(dateStr: string, departmentName: string): boolean {
  const day  = new Date(dateStr + 'T00:00:00').getDay(); // 0=Sun, 6=Sat
  // Normalize: lowercase, collapse spaces around hyphens
  const dept = (departmentName ?? '').toLowerCase().trim().replace(/\s*-\s*/g, '-');
  if (DOUBLE_RESTDAY_DEPTS.includes(dept)) return day === 0 || day === 6;
  return day === 0;
}

async function fetchCollection(path: string, token: string | undefined) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Cookie'] = `${COOKIE_NAME}=${token}`;
  const res = await fetch(`${DIRECTUS_BASE}/api/items/${path}`, { headers, cache: 'no-store' });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

export async function GET(request: NextRequest) {
  const cookieStore  = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!AUTH_DISABLED && !sessionToken) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const deptId = searchParams.get('deptId');
  const from   = searchParams.get('from') ?? new Date().toISOString().split('T')[0];
  const to     = searchParams.get('to')   ?? from;

  try {
    // ── 1. Fetch departments + schedules ──────────────────────────────────
    const [deptsRes, schedRes] = await Promise.all([
      fetchCollection('department?limit=-1&fields=department_id,department_name', sessionToken),
      fetchCollection('department_schedule?limit=-1&fields=department_id,work_start,work_end,grace_period,working_days,workdays_note', sessionToken),
    ]);

    const depts:  Record<string, unknown>[] = deptsRes.data  ?? [];
    const scheds: Record<string, unknown>[] = schedRes.data  ?? [];
    const deptMap  = new Map(depts.map((d) => [d.department_id, d]));
    const schedMap = new Map(scheds.map((s) => [s.department_id, s]));

    const departments = depts.map((d) => {
      const s = schedMap.get(d.department_id) ?? {};
      return {
        department_id:   d.department_id,
        department_name: d.department_name,
        work_start:      (s as Record<string, unknown>).work_start  ?? null,
        work_end:        (s as Record<string, unknown>).work_end    ?? null,
        grace_period:    (s as Record<string, unknown>).grace_period ?? 5,
        working_days:    (s as Record<string, unknown>).working_days ?? 5,
        workdays_note:   (s as Record<string, unknown>).workdays_note ?? null,
      };
    });

    // ── 2. Fetch ALL employees (filtered by dept if provided) ─────────────
    const userFields = 'user_id,user_fname,user_lname,user_position,user_image,user_department';
    const userFilter = deptId
      ? `filter[user_department][_eq]=${deptId}&`
      : '';
    const usersRes = await fetchCollection(
      `user?${userFilter}limit=-1&fields=${userFields}`,
      sessionToken,
    );
    const allUsers: Record<string, unknown>[] = (usersRes.data ?? [])
      .filter((u: Record<string, unknown>) => !u.is_deleted && !u.isDeleted);

    // ── 3. Fetch attendance logs for date range ───────────────────────────
    let logsPath = `attendance_log?filter[log_date][_gte]=${from}&filter[log_date][_lte]=${to}&limit=-1`;
    if (deptId) logsPath += `&filter[department_id][_eq]=${deptId}`;
    const logsRes = await fetchCollection(logsPath, sessionToken);
    const logs: Record<string, unknown>[] = logsRes.data ?? [];

    // Build log map: "userId-date" → log
    const logMap = new Map<string, Record<string, unknown>>();
    logs.forEach((l) => {
      logMap.set(`${l.user_id}-${l.log_date}`, l);
    });

    // ── 4. Generate date range ─────────────────────────────────────────────
    // ✅ Use local date formatter — NOT toISOString() which shifts to UTC
    const dates: string[] = [];
    const cursor = new Date(from + 'T00:00:00');
    const endDate = new Date(to + 'T00:00:00');
    while (cursor <= endDate) {
      dates.push(toLocalYMD(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    // ── 5. Merge: every employee × every date ─────────────────────────────
    // This ensures ALL employees in the dept appear, even those with no log
    const merged: Record<string, unknown>[] = [];

    for (const user of allUsers) {
      const deptIdForUser = user.user_department;
      const dept  = deptMap.get(deptIdForUser)  ?? {};
      const sched = schedMap.get(deptIdForUser) ?? {};

      for (const date of dates) {
        const log = logMap.get(`${user.user_id}-${date}`);
        
        let status = 'Absent';
        if (log) {
          status = log.status ? String(log.status) : 'Absent';
          // If log exists but no time_in, mark as Absent
          if (!log.time_in) {
            status = 'Absent';
          }
        } else {
          // No log for this date — check if it's a rest day
          const deptName = (dept as Record<string, unknown>).department_name ?? '—';
          if (isRestDay(date, String(deptName))) {
            status = 'Rest Day';
          }
        }

        merged.push({
          // From log (or null if no log exists)
          log_id:          log?.log_id          ?? null,
          user_id:         user.user_id,
          department_id:   deptIdForUser,
          log_date:        date,
          time_in:         log?.time_in         ?? null,
          lunch_start:     log?.lunch_start     ?? null,
          lunch_end:       log?.lunch_end       ?? null,
          break_start:     log?.break_start     ?? null,
          break_end:       log?.break_end       ?? null,
          time_out:        log?.time_out        ?? null,
          status:          status,
          approval_status: log?.approval_status ?? 'pending',
          // From user
          user_fname:      user.user_fname,
          user_lname:      user.user_lname,
          user_position:   user.user_position ?? '—',
          user_image:      user.user_image    ?? null,
          // From dept/schedule
          department_name: (dept as Record<string, unknown>).department_name ?? '—',
          work_start:      (sched as Record<string, unknown>).work_start     ?? null,
          work_end:        (sched as Record<string, unknown>).work_end       ?? null,
          grace_period:    (sched as Record<string, unknown>).grace_period   ?? 5,
        });
      }
    }

    return NextResponse.json({ departments, logs: merged });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[HRM/DeptReport]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}