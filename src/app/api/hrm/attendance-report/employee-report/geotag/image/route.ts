// src/app/api/hrm/attendance-report/employee-report/geotag/image/route.ts

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIRECTUS_BASE  = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id || id === 'null' || id === 'undefined') {
    return new NextResponse('Valid Image ID Required', { status: 400 });
  }

  if (!DIRECTUS_BASE || !DIRECTUS_TOKEN) {
    console.error('[HRM/Geotag/Image] Missing env vars');
    return new NextResponse('Server configuration error', { status: 500 });
  }

  try {
    const response = await fetch(`${DIRECTUS_BASE}/assets/${id}`, {
      headers: {
        'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
      },
    });

    if (!response.ok) return new NextResponse('Not Found', { status: 404 });

    const blob = await response.blob();
    return new NextResponse(blob, {
      headers: {
        'Content-Type':  response.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[HRM/Geotag/Image]', msg);
    return new NextResponse(msg, { status: 500 });
  }
}