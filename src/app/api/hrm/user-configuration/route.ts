import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const UPSTREAM_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function proxy(req: NextRequest) {
  if (!UPSTREAM_BASE) {
    console.error("[Proxy] NEXT_PUBLIC_API_BASE_URL is not defined in environment.");
    return NextResponse.json({ 
        error: "Server Configuration Error: NEXT_PUBLIC_API_BASE_URL missing." 
    }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const limit = searchParams.get("limit") || "1000";
  const offset = searchParams.get("offset") || "0";

  // Strictly use items/user with fields matched to the provided DDL
  const upstreamUrl = `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/user?limit=${limit}&offset=${offset}&fields=user_id,user_email,user_fname,user_mname,user_lname,user_image&meta=filter_count`;
  
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
        console.error(`[Proxy] Upstream Error (${res.status}):`, errorBody);
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

    const data = await res.arrayBuffer();
    return new NextResponse(data, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    console.error("[Proxy] Fetch fatal error:", err.message);
    return NextResponse.json({ 
        error: "Failed to connect to upstream API", 
        message: err.message 
    }, { status: 502 });
  }
}

export async function GET(req: NextRequest) { return proxy(req); }
