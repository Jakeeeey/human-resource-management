import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const UPSTREAM_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function proxy(req: NextRequest) {
  if (!UPSTREAM_BASE) {
    console.error("[User Config - Users Proxy] NEXT_PUBLIC_API_BASE_URL is not defined in environment.");
    return NextResponse.json({ 
        error: "Server Configuration Error: NEXT_PUBLIC_API_BASE_URL missing." 
    }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const limit = searchParams.get("limit") || "1000";
  const offset = searchParams.get("offset") || "0";
  const search = searchParams.get("search");

  // Strictly use items/user with fields matched to the provided DDL
  let upstreamUrl = `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/user?limit=${limit}&offset=${offset}&fields=user_id,user_email,user_fname,user_mname,user_lname&meta=filter_count&filter[role][_neq]=ADMIN`;
  
  if (search) {
    upstreamUrl += `&search=${encodeURIComponent(search)}`;
  }
  
  const headers = new Headers();
  headers.set("content-type", "application/json");
  const hasToken = !!process.env.DIRECTUS_STATIC_TOKEN;
  
  if (hasToken) {
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
        console.error(`[User Config - Users Proxy] Upstream Error (${res.status}):`, errorBody);
        return NextResponse.json({ 
            error: "Upstream API Error", 
            upstreamStatus: res.status,
            upstreamBody: errorBody.substring(0, 200),
            debugInfo: {
                url: upstreamUrl,
                hasToken: hasToken
            }
        }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[User Config - Users Proxy] Fetch fatal error:", message);
    return NextResponse.json({ 
        error: "Failed to connect to upstream API", 
        message: message 
    }, { status: 502 });
  }
}

export async function GET(req: NextRequest) { return proxy(req); }
