// src/app/api/hrm/attendance-report/employee-report/geotag/check/route.ts

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIRECTUS_BASE  = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

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

  if (!DIRECTUS_BASE || !DIRECTUS_TOKEN) {
    console.error('[HRM/Geotag/Check] Missing env vars');
    return NextResponse.json({ logIdsWithGeotag: [] });
  }

  try {
    const inFilter = logIds.map((id) => `filter[log_id][_in][]=${id}`).join('&');
    const url = `${DIRECTUS_BASE}/items/attendance_log_geotag`
      + `?${inFilter}`
      + `&limit=-1`
      + `&fields=log_id`;

    const res = await fetch(url, {
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
      },
      cache: 'no-store',
    });

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