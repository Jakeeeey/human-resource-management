import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/hrm/employee-admin/employee-master-list/department-positions
 * Fetches the department positions list from the Directus backend.
 */
export async function GET(req: NextRequest) {
  try {
    const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!DIRECTUS_URL) {
      return NextResponse.json({ error: "Directus API base not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const fields = searchParams.get("fields") || "*";
    const limit = searchParams.get("limit") || "-1";
    // pass filter to allow filtering by department_id
    const filter = searchParams.get("filter") || "";

    let upstreamUrl = `${DIRECTUS_URL.replace(/\/+$/, "")}/items/department_positions?fields=${fields}&limit=${limit}`;
    if (filter) {
      upstreamUrl += `&filter=${filter}`;
    }

    const res = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      },
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Proxy request failed";
    console.error("[Proxy Error] GET /department-positions:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!DIRECTUS_URL) {
      return NextResponse.json({ error: "Directus API base not configured" }, { status: 500 });
    }

    const body = await req.json();

    const upstreamUrl = `${DIRECTUS_URL.replace(/\/+$/, "")}/items/department_positions`;

    const res = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Proxy request failed";
    console.error("[Proxy Error] POST /department-positions:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
