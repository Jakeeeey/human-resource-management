import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const UPSTREAM_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

function decodeJwt(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        let s = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        while (s.length % 4) s += "=";
        const json = Buffer.from(s, "base64").toString("utf8");
        return JSON.parse(json);
    } catch {
        return null;
    }
}

async function proxy(req: NextRequest) {
  if (!UPSTREAM_BASE) {
    return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter");
  const limit = searchParams.get("limit") || "100";
  const fields = searchParams.get("fields") || "id,user_id,module_id";

  // Point to the new junction table for modules
  let upstreamUrl = `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/user_access_modules`;
  
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
  const directusToken = process.env.DIRECTUS_STATIC_TOKEN;
  if (directusToken) headers.set("Authorization", `Bearer ${directusToken}`);

  try {
    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method === "POST" || req.method === "PATCH" || req.method === "DELETE") {
      try {
        const body = await req.json();
        
        let currentAdminId: number | null = null;
        const tokenVal = req.cookies.get("vos_access_token")?.value;
        if (tokenVal) {
            const payload = decodeJwt(tokenVal);
            if (payload && payload.sub) currentAdminId = Number(payload.sub);
        }

        if (body) {
          if (req.method === "POST" && Array.isArray(body)) {
             body.forEach(item => { 
                 if (currentAdminId && !item.created_by) {
                     item.created_by = currentAdminId;
                 }
             });
          }
          fetchOptions.body = JSON.stringify(body);
        }
      } catch (e) {
        if (req.method !== "DELETE") throw e;
      }
    }

    const res = await fetch(upstreamUrl, fetchOptions);

    if (!res.ok) {
        const errorBody = await res.text();
        console.error(`[User Config - Access Modules Proxy] Upstream Error (${res.status}):`, errorBody);
        return NextResponse.json({ error: "Upstream Error", details: errorBody }, { status: res.status });
    }

    if (req.method === "DELETE") {
        return new NextResponse(null, { status: 204 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[User Config - Access Modules Proxy] Connection Error:`, message);
    return NextResponse.json({ error: "Connection Error", message }, { status: 502 });
  }
}

export async function GET(req: NextRequest) { return proxy(req); }
export async function POST(req: NextRequest) { return proxy(req); }
export async function DELETE(req: NextRequest) { return proxy(req); }
