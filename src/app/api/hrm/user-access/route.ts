import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const UPSTREAM_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function proxy(req: NextRequest) {
  if (!UPSTREAM_BASE) {
    return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter");
  const limit = searchParams.get("limit") || "100";
  const fields = searchParams.get("fields") || "user_id,item_slug";

  // Construct upstream URL
  let upstreamUrl = `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/user_access`;
  
  // Append query params for GET and DELETE (Directus supports filter on DELETE)
  const queryParams = new URLSearchParams();
  if (filter) queryParams.set("filter", filter);
  if (req.method === "GET") {
    queryParams.set("limit", limit);
    queryParams.set("fields", fields);
  }
  
  const queryString = queryParams.toString();
  if (queryString) upstreamUrl += `?${queryString}`;
  
  const headers = new Headers();
  headers.set("content-type", "application/json");
  const token = process.env.DIRECTUS_STATIC_TOKEN;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  try {
    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method === "POST" || req.method === "PATCH" || req.method === "DELETE") {
      try {
        const body = await req.json();
        if (body) fetchOptions.body = JSON.stringify(body);
      } catch (e) {
        // Body might be empty or invalid, skip for DELETE
        if (req.method !== "DELETE") throw e;
      }
    }

    const res = await fetch(upstreamUrl, {
        ...fetchOptions,
    });

    if (!res.ok) {
        const errorBody = await res.text();
        console.error(`[UserAccess Proxy] Upstream Error (${res.status}):`, errorBody);
        return NextResponse.json({ error: "Upstream Error", details: errorBody }, { status: res.status });
    }

    if (req.method === "DELETE") {
        return new NextResponse(null, { status: 204 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Connection Error", message }, { status: 502 });
  }
}

export async function GET(req: NextRequest) { return proxy(req); }
export async function POST(req: NextRequest) { return proxy(req); }
export async function DELETE(req: NextRequest) { return proxy(req); }
