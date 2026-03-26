// src/app/api/hrm/attendance-report/employee-report/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIRECTUS_BASE = process.env.NEXT_PUBLIC_DIRECTUS_BASE_URL;
const COOKIE_NAME   = 'vos_access_token';
const AUTH_DISABLED = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true';

async function fetchCollection(path: string, sessionToken: string | undefined) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionToken) headers['Cookie'] = `${COOKIE_NAME}=${sessionToken}`;
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

  try {
    const [usersRes, deptsRes, schedRes] = await Promise.all([
      fetchCollection('user?limit=-1&fields=user_id,user_fname,user_lname,user_email,user_position,user_image,user_department', sessionToken),
      fetchCollection('department?limit=-1&fields=department_id,department_name', sessionToken),
      fetchCollection('department_schedule?limit=-1&fields=department_id,work_start,work_end,working_days,workdays_note,grace_period', sessionToken),
    ]);

    const users: Record<string, unknown>[] = usersRes.data ?? [];
    const depts: Record<string, unknown>[] = deptsRes.data ?? [];
    const scheds: Record<string, unknown>[] = schedRes.data ?? [];

    const deptMap  = new Map(depts.map((d) => [d.department_id, d]));
    const schedMap = new Map(scheds.map((s) => [s.department_id, s]));

    const merged = users
      .filter((u) => !u.is_deleted && !u.isDeleted)
      .map((u) => {
        const dept  = deptMap.get(u.user_department)  ?? {};
        const sched = schedMap.get(u.user_department) ?? {};
        return {
          user_id:         u.user_id,
          user_fname:      u.user_fname,
          user_lname:      u.user_lname,
          user_email:      u.user_email,
          user_position:   u.user_position,
          user_image:      u.user_image ?? null,
          department_id:   u.user_department,
          department_name: dept.department_name ?? '—',
          work_start:      sched.work_start   ?? null,
          work_end:        sched.work_end     ?? null,
          working_days:    sched.working_days ?? 5,
          workdays_note:   sched.workdays_note ?? null,
          grace_period:    sched.grace_period ?? 5,
        };
      })
      .sort((a, b) =>
        String(a.user_lname).localeCompare(String(b.user_lname)) ||
        String(a.user_fname).localeCompare(String(b.user_fname))
      );

    return NextResponse.json({ data: merged });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[HRM/EmployeeReport]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}