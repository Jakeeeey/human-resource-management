// src/app/api/hrm/attendance-report/employee-report/route.ts

import { NextResponse } from 'next/server';
import { getActiveOncall, extractScheduleFields } from '../../../../../modules/human-resource-management/workforce/attendance-report/employee-report/utils/oncall';

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

async function fetchCollection(collection: string, params: Record<string, string>) {
  const query = new URLSearchParams({ limit: '-1', ...params });
  const url   = `${DIRECTUS_BASE}/items/${collection}?${query}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type':  'application/json',
      'Accept':        'application/json',
      'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`${collection} error: ${res.status}`);
  return res.json();
}

// FIXED: Removed unused _request parameter
export async function GET() {
  if (!DIRECTUS_BASE || !DIRECTUS_TOKEN) {
    return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const [usersRes, deptsRes, schedRes, oncallListRes, oncallSchedRes] = await Promise.all([
      fetchCollection('user', { fields: 'user_id,user_fname,user_lname,user_email,user_position,user_image,user_department,is_deleted' }),
      fetchCollection('department', { fields: 'department_id,department_name' }),
      fetchCollection('department_schedule', { fields: 'department_id,work_start,work_end,working_days,workdays_note,grace_period' }),
      fetchCollection('oncall_list', {}),
      fetchCollection('oncall_schedule', { fields: '*' }),
    ]);

    const deptMap  = new Map((deptsRes.data ?? []).map((d: any) => [d.department_id, d]));
    const schedMap = new Map((schedRes.data ?? []).map((s: any) => [s.department_id, s]));
    const today = new Date().toISOString().slice(0, 10);

    const merged = (usersRes.data ?? [])
      .filter((u: any) => !isDeleted(u.is_deleted))
      .map((u: any) => {
        const dept  = (deptMap.get(u.user_department)  ?? {}) as any;
        const sched = (schedMap.get(u.user_department) ?? {}) as any;
        const oncallSched = getActiveOncall(u.user_id, today, oncallListRes.data, oncallSchedRes.data);
        const schedFields = extractScheduleFields(oncallSched, sched);
        return {
          user_id: u.user_id,
          user_fname: u.user_fname,
          user_lname: u.user_lname,
          user_email: u.user_email,
          user_position: u.user_position,
          user_image: u.user_image ?? null,
          department_id: u.user_department,
          department_name: dept.department_name ?? '—',
          work_start: schedFields.work_start ?? null,
          work_end: schedFields.work_end ?? null,
        };
      })
      .sort((a: any, b: any) => String(a.user_lname).localeCompare(String(b.user_lname)));

    return NextResponse.json({ data: merged });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 502 });
  }
}