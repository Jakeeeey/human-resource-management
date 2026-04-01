// src/app/api/hrm/attendance-report/employee-report/geotag/route.ts

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIRECTUS_BASE  = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const logId = searchParams.get('logId');

  if (!logId) {
    return NextResponse.json({ ok: false, message: 'Missing logId' }, { status: 400 });
  }

  if (!DIRECTUS_BASE || !DIRECTUS_TOKEN) {
    console.error('[HRM/Geotag] Missing env vars');
    return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const url = `${DIRECTUS_BASE}/items/attendance_log_geotag`
      + `?filter[log_id][_eq]=${logId}`
      + `&limit=10`
      + `&fields=geotag_id,log_id,kind,position,image_path,captured_at`;

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
    return NextResponse.json({ tags: data.data ?? [] });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[HRM/Geotag]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}