import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const UPSTREAM_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;  // Directus
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
const SPRING_BASE = process.env.SPRING_API_BASE_URL;        // Spring Boot

async function proxy(req: NextRequest) {
  const url = new URL(req.url);
  const { pathname, search } = url;

  // Extract the segment after /employee-master-list/
  const segment = pathname.split("/employee-master-list/")[1];

  const method = req.method;
  const isReadOp = ["GET", "HEAD"].includes(method);

  // ── Route to the correct upstream ──────────────────────────────────────────

  // GET /employees  →  Spring Boot /users
  if (segment === "employees" && isReadOp) {
    if (!SPRING_BASE) {
      return NextResponse.json({ error: "Spring Boot API base not configured" }, { status: 500 });
    }

    // Forward the VOS access token as Bearer so Spring Boot accepts the request
    const vosToken = req.cookies.get("vos_access_token")?.value;

    const upstreamUrl = `${SPRING_BASE.replace(/\/+$/, "")}/users`;

    try {
      const res = await fetch(upstreamUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(vosToken ? { Authorization: `Bearer ${vosToken}` } : {}),
        },
        cache: "no-store",
      });

      const data = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "application/json";
      return new NextResponse(data, {
        status: res.status,
        headers: { "content-type": contentType },
      });
    } catch (err) {
      console.error("[Proxy Error] GET /users (Spring):", err);
      return NextResponse.json({ error: "Proxy request failed" }, { status: 502 });
    }
  }

  // All other segments → Directus
  if (!UPSTREAM_BASE) {
    return NextResponse.json({ error: "Upstream API base not configured" }, { status: 500 });
  }

  // Mapping local segments to Directus items
  let upstreamGETPath = "";   // only used for GET/HEAD — includes field expansion + limit
  let upstreamMutatePath = ""; // used for POST/PATCH/DELETE — clean resource path

  switch (segment) {
    case "employees":
      upstreamGETPath = "/items/user?fields=*.*,user_department.*&limit=-1";
      upstreamMutatePath = "/items/user";
      break;
    case "departments":
      upstreamGETPath = "/items/department?fields=*&limit=-1";
      upstreamMutatePath = "/items/department";
      break;
    default:
      if (segment.startsWith("employees/")) {
        const id = segment.split("/")[1];
        upstreamGETPath = `/items/user/${id}?fields=*.*,user_department.*`;
        upstreamMutatePath = `/items/user/${id}`;
      } else if (segment.startsWith("departments/")) {
        const id = segment.split("/")[1];
        upstreamGETPath = `/items/department/${id}`;
        upstreamMutatePath = `/items/department/${id}`;
      } else if (segment.startsWith("assets/")) {
        upstreamGETPath = `/${segment}`;
        upstreamMutatePath = `/${segment}`;
      }
  }

  const rawPath = isReadOp ? upstreamGETPath : upstreamMutatePath;

  if (!rawPath) {
    return NextResponse.json({ error: `Invalid proxy segment: ${segment}` }, { status: 400 });
  }

  // Append extra search params only for reads (avoid polluting mutations)
  const upstreamUrl = `${UPSTREAM_BASE.replace(/\/+$/, "")}${rawPath}${isReadOp && search ? (rawPath.includes("?") ? `&${search.slice(1)}` : search) : ""
    }`;

  const headers = new Headers();
  if (DIRECTUS_TOKEN) {
    headers.set("Authorization", `Bearer ${DIRECTUS_TOKEN}`);
  }

  let body: BodyInit | undefined;
  if (!isReadOp) {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      // Forward raw multipart body — do NOT set Content-Type, browser sets boundary
      body = await req.arrayBuffer();
    } else {
      headers.set("Content-Type", "application/json");
      body = await req.arrayBuffer();
    }
  }

  try {
    const res = await fetch(upstreamUrl, {
      method,
      headers,
      body,
      cache: "no-store",
    });

    const data = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "application/json";

    return new NextResponse(data, {
      status: res.status,
      headers: { "content-type": contentType },
    });
  } catch (err) {
    console.error(`[Proxy Error] ${method} ${upstreamUrl}:`, err);
    return NextResponse.json({ error: "Proxy request failed" }, { status: 502 });
  }
}

export async function GET(req: NextRequest) { return proxy(req); }
export async function POST(req: NextRequest) { return proxy(req); }
export async function DELETE(req: NextRequest) { return proxy(req); }
export async function PATCH(req: NextRequest) { return proxy(req); }
