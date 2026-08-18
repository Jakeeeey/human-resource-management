import { NextResponse } from "next/server";

export const runtime = "nodejs";

const UPSTREAM_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function proxy() {
    if (!UPSTREAM_BASE) {
        return NextResponse.json({ error: "Server Configuration Error: NEXT_PUBLIC_API_BASE_URL missing." }, { status: 500 });
    }

    // Filter to get only attendance settings
    const upstreamUrl = `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/general_setting?filter[setting_key][_in]=rfid_attendance,face_attendance`;

    const headers = new Headers();
    headers.set("content-type", "application/json");
    if (process.env.DIRECTUS_STATIC_TOKEN) {
        headers.set("Authorization", `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`);
    }

    try {
        const res = await fetch(upstreamUrl, {
            method: "GET",
            headers,
            next: { revalidate: 0 },
        });

        if (!res.ok) {
            const errorBody = await res.text();
            return NextResponse.json({ error: "Upstream API Error", details: errorBody }, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: "Failed to connect to upstream API", message }, { status: 502 });
    }
}

export async function GET() {
    return proxy();
}
