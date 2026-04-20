// src/app/api/hrm/workforce/attendance-report/employee-report/geotag/route.ts

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIRECTUS_BASE  = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

async function fetchGeotags(logId: number) {
  if (!DIRECTUS_BASE || !DIRECTUS_TOKEN) {
    throw new Error('Missing env vars');
  }

  const url = `${DIRECTUS_BASE}/items/attendance_log_geotag`
    + `?filter[log_id][_eq]=${logId}`
    + `&limit=-1`
    + `&fields=geotag_id,log_id,kind,position,image_path,captured_at`;

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Directus ${res.status}: ${body.slice(0, 200)}`);
  }

  return res.json();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const logId = searchParams.get('logId');

  if (!logId || isNaN(Number(logId))) {
    return NextResponse.json({ tags: [] }, { status: 400 });
  }

  try {
    const result = await fetchGeotags(Number(logId));
    const tags = result.data ?? [];
    return NextResponse.json({ tags });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[HRM/Geotag]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
