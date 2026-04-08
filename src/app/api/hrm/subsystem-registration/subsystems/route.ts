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
  let upstreamUrl = `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/subsystems`;
  if (id) upstreamUrl += `/${id}`;

  // Add fields for GET if no ID (listing)
  if (req.method === "GET" && !id) {
    upstreamUrl += `?fields=*,modules.*,modules.subModules.*`;
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

    if (["POST", "PATCH", "PUT"].includes(req.method)) {
      const body = await req.json();
      fetchOptions.body = JSON.stringify(body);
    }

    const res = await fetch(upstreamUrl, {
      ...fetchOptions,
    });

    if (!res.ok) {
        const errorBody = await res.text();
        console.error(`[Subsystem Reg - Subsystems Proxy] Upstream Error (${res.status}):`, errorBody);
        return NextResponse.json({ error: "Upstream Error", details: errorBody }, { status: res.status });
    }

    if (req.method === "DELETE") {
        return new NextResponse(null, { status: 204 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Subsystem Reg - Subsystems Proxy] Connection Error:`, message);
    return NextResponse.json({ error: "Connection Error", message }, { status: 502 });
  }
}

export async function GET(req: NextRequest) { return proxy(req); }
export async function POST(req: NextRequest) { return proxy(req); }
export async function PATCH(req: NextRequest) { return proxy(req); }
export async function DELETE(req: NextRequest) { return proxy(req); }
