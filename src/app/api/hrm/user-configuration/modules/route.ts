import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const UPSTREAM_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function proxy() {
  if (!UPSTREAM_BASE) {
    console.error("[User Config - Modules Registry Proxy] NEXT_PUBLIC_API_BASE_URL missing.");
    return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
  }

  // Fetch all modules for registry tree building
  const upstreamUrl = `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/modules?limit=-1&sort=sort`;
  
  const headers = new Headers();
  headers.set("content-type", "application/json");
  const token = process.env.DIRECTUS_STATIC_TOKEN;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  try {
    const res = await fetch(upstreamUrl, {
      method: "GET",
      headers,
      next: { revalidate: 0 },
    });

    if (!res.ok) {
        const errorBody = await res.text();
        console.error(`[User Config - Modules Registry Proxy] Upstream Error (${res.status}):`, errorBody);
        return NextResponse.json({ error: "Upstream Error", details: errorBody }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[User Config - Modules Registry Proxy] Fetch error:`, message);
    return NextResponse.json({ error: "Connection Error", message }, { status: 502 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: NextRequest) { return proxy(); }
