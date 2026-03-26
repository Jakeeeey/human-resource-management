// src/app/api/hrm/attendance-report/employee-report/geotag/image/route.ts

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIRECTUS_BASE = 'http://192.168.0.143:9874';
const COOKIE_NAME   = 'vos_access_token';

export async function GET(req: Request) {
  try {
    const cookieStore  = await cookies();
    const sessionToken = cookieStore.get(COOKIE_NAME)?.value;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id || id === 'null' || id === 'undefined') {
      return new NextResponse('Valid Image ID Required', { status: 400 });
    }

    const headers: Record<string, string> = {};
    if (sessionToken) headers['Cookie'] = `${COOKIE_NAME}=${sessionToken}`;

    const response = await fetch(
      `${DIRECTUS_BASE}/assets/${id}`,
      { headers },
    );

    if (!response.ok) return new NextResponse('Not Found', { status: 404 });

    const blob = await response.blob();
    return new NextResponse(blob, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return new NextResponse(msg, { status: 500 });
  }
}