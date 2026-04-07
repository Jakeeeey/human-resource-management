import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/hrm/employee-admin/employee-master-list/departments
 * Fetches the department list from the Directus backend.
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

    const upstreamUrl = `${DIRECTUS_URL.replace(/\/+$/, "")}/items/department?fields=${fields}&limit=${limit}`;

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
    console.error("[Proxy Error] GET /departments:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
