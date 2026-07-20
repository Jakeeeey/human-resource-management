import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const UPSTREAM_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    if (!UPSTREAM_BASE) {
        return NextResponse.json({ error: "Server Configuration Error: NEXT_PUBLIC_API_BASE_URL missing." }, { status: 500 });
    }

    const { id } = await props.params;

    if (!id) {
        return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    let body;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const upstreamUrl = `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/general_setting/${id}`;

    const headers = new Headers();
    headers.set("content-type", "application/json");
    if (process.env.DIRECTUS_STATIC_TOKEN) {
        headers.set("Authorization", `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`);
    }

    try {
        const res = await fetch(upstreamUrl, {
            method: "PATCH",
            headers,
            body: JSON.stringify(body),
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
