import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const UPSTREAM_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function proxy(req: NextRequest) {
    if (!UPSTREAM_BASE) {
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const scheduleId = searchParams.get("schedule_id");

    if (!scheduleId) {
        return NextResponse.json({ error: "schedule_id is required" }, { status: 400 });
    }

    // Construct upstream URL for manu_hr_schedule_attendance
    let upstreamUrl = `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/manu_hr_schedule_attendance`;

    const queryParams = new URLSearchParams();
    queryParams.set("filter[schedule_id][_eq]", scheduleId);
    queryParams.set("fields", "*,user_id.*"); // Get all fields plus joined user info
    queryParams.set("limit", "-1");

    const queryString = queryParams.toString();
    upstreamUrl += `?${queryString}`;

    const headers = new Headers();
    headers.set("content-type", "application/json");
    const token = process.env.DIRECTUS_STATIC_TOKEN;
    if (token) headers.set("Authorization", `Bearer ${token}`);

    try {
        const res = await fetch(upstreamUrl, {
            method: "GET",
            headers,
            cache: "no-store"
        });

        if (!res.ok) {
            const errorBody = await res.text();
            console.error(`[Manufacturing - Attendance Proxy] Upstream Error (${res.status}):`, errorBody);
            return NextResponse.json({ error: "Upstream Error", details: errorBody }, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Manufacturing - Attendance Proxy] Connection Error:`, message);
        return NextResponse.json({ error: "Connection Error", message }, { status: 502 });
    }
}

export async function GET(req: NextRequest) {
    return proxy(req);
}
