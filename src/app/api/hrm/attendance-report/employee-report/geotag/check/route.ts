// src/app/api/hrm/attendance-report/employee-report/geotag/check/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIRECTUS_BASE = 'http://192.168.0.143:9874';
const COOKIE_NAME   = 'vos_access_token';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const logIdsParam = searchParams.get('logIds');

  if (!logIdsParam) {
    return NextResponse.json({ logIdsWithGeotag: [] });
  }

  const logIds = logIdsParam
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (logIds.length === 0) {
    return NextResponse.json({ logIdsWithGeotag: [] });
  }

  try {
    const cookieStore  = await cookies();
    const sessionToken = cookieStore.get(COOKIE_NAME)?.value;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (sessionToken) headers['Cookie'] = `${COOKIE_NAME}=${sessionToken}`;

    const inFilter = logIds.map((id) => `filter[log_id][_in][]=${id}`).join('&');
    const url = `${DIRECTUS_BASE}/api/items/attendance_log_geotag`
      + `?${inFilter}`
      + `&limit=-1`
      + `&fields=log_id`;

    const res = await fetch(url, { headers, cache: 'no-store' });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Directus ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const records: { log_id: number }[] = data.data ?? [];
    const withGeotag = [...new Set(records.map((r) => Number(r.log_id)))];

    return NextResponse.json({ logIdsWithGeotag: withGeotag });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[HRM/Geotag/Check]', msg);
    return NextResponse.json({ logIdsWithGeotag: [] });
  }
}