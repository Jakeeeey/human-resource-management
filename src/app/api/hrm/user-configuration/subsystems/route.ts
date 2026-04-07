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
  let upstreamUrl = `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/subsystems?limit=-1`;
  if (id) upstreamUrl = `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/subsystems/${id}`;
  
  const headers = new Headers();
  headers.set("content-type", "application/json");
  const token = process.env.DIRECTUS_STATIC_TOKEN;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  try {
    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    const res = await fetch(upstreamUrl, {
      ...fetchOptions,
    });

    if (!res.ok) {
        const errorBody = await res.text();
        console.error(`[User Config - Subsystems Proxy] Upstream Error (${res.status}):`, errorBody);
        return NextResponse.json({ error: "Upstream Error", details: errorBody }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[User Config - Subsystems Proxy] Connection Error:`, message);
    return NextResponse.json({ error: "Connection Error", message }, { status: 502 });
  }
}

export async function GET(req: NextRequest) { return proxy(req); }
