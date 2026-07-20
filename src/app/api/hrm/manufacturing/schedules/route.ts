import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const UPSTREAM_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function proxy(req: NextRequest) {
    if (!UPSTREAM_BASE) {
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    // Construct upstream URL
    let upstreamUrl = `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/manu_hr_schedules`;
    if (id) upstreamUrl += `/${id}`;

    // Forward all query parameters from the client to upstream
    const queryParams = new URLSearchParams(searchParams);
    queryParams.delete("id"); // Remove proxy-specific internal param

    // Auto-include joins on GET requests if not specified
    if (req.method === "GET" && !queryParams.has("fields")) {
        queryParams.set("fields", "*,line.*,positions.*,positions.position.*,manu_hr_schedule_positions.*,manu_hr_schedule_positions.position.*");
    }

    const queryString = queryParams.toString();
    if (queryString) {
        upstreamUrl += (upstreamUrl.includes("?") ? "&" : "?") + queryString;
    }

    const headers = new Headers();
    headers.set("content-type", "application/json");
    const token = process.env.DIRECTUS_STATIC_TOKEN;
    if (token) headers.set("Authorization", `Bearer ${token}`);

    try {
        const fetchOptions: RequestInit = {
            method: req.method,
            headers,
        };

        if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
            try {
                const body = await req.json();
                fetchOptions.body = JSON.stringify(body);
            } catch {}
        }

        const res = await fetch(upstreamUrl, { ...fetchOptions });

        if (!res.ok) {
            const errorBody = await res.text();
            console.error(`[Manufacturing - Schedules Proxy] Upstream Error (${res.status}):`, errorBody);
            return NextResponse.json({ error: "Upstream Error", details: errorBody }, { status: res.status });
        }

        if (req.method === "DELETE") {
            return new NextResponse(null, { status: 204 });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Manufacturing - Schedules Proxy] Connection Error:`, message);
        return NextResponse.json({ error: "Connection Error", message }, { status: 502 });
    }
}

export async function GET(req: NextRequest) { return proxy(req); }
export async function POST(req: NextRequest) { return proxy(req); }
export async function PATCH(req: NextRequest) { return proxy(req); }
export async function DELETE(req: NextRequest) { return proxy(req); }
