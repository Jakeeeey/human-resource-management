// src/app/api/hrm/attendance-report/employee-report/geotag/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIRECTUS_BASE = 'http://192.168.0.143:9874';
const COOKIE_NAME   = 'vos_access_token';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const logId = searchParams.get('logId');

  if (!logId) {
    return NextResponse.json({ ok: false, message: 'Missing logId' }, { status: 400 });
  }

  try {
    const cookieStore  = await cookies();
    const sessionToken = cookieStore.get(COOKIE_NAME)?.value;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    // Pass cookie if available — but don't block the request if missing
    if (sessionToken) headers['Cookie'] = `${COOKIE_NAME}=${sessionToken}`;

    const url = `${DIRECTUS_BASE}/api/items/attendance_log_geotag`
      + `?filter[log_id][_eq]=${logId}`
      + `&limit=10`
      + `&fields=geotag_id,log_id,kind,position,image_path,captured_at`;

    const res = await fetch(url, { headers, cache: 'no-store' });

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