// src/app/api/hrm/attendance-report/employee-report/route.ts

import { NextRequest, NextResponse } from 'next/server';
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

async function fetchCollection(
  collection: string,
  params: Record<string, string>,
) {
  const query = new URLSearchParams({ limit: '-1', ...params });
  const url   = `${DIRECTUS_BASE}/items/${collection}?${query}`;

  console.log(`[HRM/Employee] GET ${url}`);
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

export async function GET(_request: NextRequest) {
  if (!DIRECTUS_BASE || !DIRECTUS_TOKEN) {
    console.error('[HRM/Employee] Missing NEXT_PUBLIC_API_BASE_URL or DIRECTUS_STATIC_TOKEN');
    return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const [usersRes, deptsRes, schedRes, oncallListRes, oncallSchedRes] = await Promise.all([
      fetchCollection('user', {
        fields: 'user_id,user_fname,user_lname,user_email,user_position,user_image,user_department,is_deleted',
      }),
      fetchCollection('department', {
        fields: 'department_id,department_name',
      }),
      fetchCollection('department_schedule', {
        fields: 'department_id,work_start,work_end,working_days,workdays_note,grace_period',
      }),
      fetchCollection('oncall_list', {}),
      fetchCollection('oncall_schedule', { fields: '*' }),
    ]);

    const users:  Record<string, unknown>[] = usersRes.data  ?? [];
    const depts:  Record<string, unknown>[] = deptsRes.data  ?? [];
    const scheds: Record<string, unknown>[] = schedRes.data  ?? [];
    const oncallList = oncallListRes.data ?? [];
    const oncallScheds = oncallSchedRes.data ?? [];

    console.log(`[HRM/Employee] users=${users.length} depts=${depts.length} scheds=${scheds.length}`);

    const deptMap  = new Map(depts.map((d) => [d.department_id, d]));
    const schedMap = new Map(scheds.map((s) => [s.department_id, s]));

    const merged = users
      .filter((u) => !isDeleted(u.is_deleted))
      .map((u) => {
        const dept  = (deptMap.get(u.user_department)  ?? {}) as Record<string, unknown>;
        const sched = (schedMap.get(u.user_department) ?? {}) as Record<string, unknown>;
        // Oncall logic
        const oncallSched = getActiveOncall(u.user_id, toLocalYMD(new Date()), oncallList, oncallScheds);
        const schedFields = extractScheduleFields(oncallSched, sched);
        return {
          user_id:         u.user_id,
          user_fname:      u.user_fname,
          user_lname:      u.user_lname,
          user_email:      u.user_email,
          user_position:   u.user_position,
          user_image:      u.user_image    ?? null,
          department_id:   u.user_department,
          department_name: dept.department_name  ?? '—',
          work_start:      schedFields.work_start      ?? null,
          work_end:        schedFields.work_end        ?? null,
          lunch_start:     schedFields.lunch_start     ?? null,
          lunch_end:       schedFields.lunch_end       ?? null,
          break_start:     schedFields.break_start     ?? null,
          break_end:       schedFields.break_end       ?? null,
          is_oncall:       !!oncallSched,
          oncall_work_start:   oncallSched ? schedFields.work_start : null,
          oncall_work_end:     oncallSched ? schedFields.work_end : null,
          oncall_lunch_start:  oncallSched ? schedFields.lunch_start : null,
          oncall_lunch_end:    oncallSched ? schedFields.lunch_end : null,
          oncall_break_start:  oncallSched ? schedFields.break_start : null,
          oncall_break_end:    oncallSched ? schedFields.break_end : null,
        };
      })
      .sort((a, b) =>
        String(a.user_lname).localeCompare(String(b.user_lname)) ||
        String(a.user_fname).localeCompare(String(b.user_fname))
      );

    return NextResponse.json({ data: merged });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[HRM/Employee] Error:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}

function toLocalYMD(date: Date): string {
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
}