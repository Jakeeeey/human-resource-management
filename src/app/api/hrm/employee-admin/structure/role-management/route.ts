import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const UPSTREAM_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * Proxy route for Role Management module.
 * Maps local /api/hrm/... calls to upstream database items/tables.
 */
async function proxy(req: NextRequest) {
  const url = new URL(req.url);
  const { pathname, search } = url;

  // Extract the segment after /role-management/
  const segment = pathname.split("/role-management/")[1];

  if (!UPSTREAM_BASE) {
    return NextResponse.json({ error: "Upstream API base not configured" }, { status: 500 });
  }

  // Map segments to upstream endpoints (adjust based on actual API structure)
  let upstreamPath = "";
  switch (segment) {
    case "executives": upstreamPath = "/items/executive?fields=*.*"; break;
    case "division-heads": upstreamPath = "/items/division_sales_head?fields=*.*,user_id.*,division_id.*"; break;
    case "supervisors": upstreamPath = "/items/supervisor_per_division?fields=*.*,supervisor_id.*,division_id.*"; break;
    case "salesman-assignments": upstreamPath = "/items/salesman_per_supervisor?fields=*.*,salesman_id.*,supervisor_per_division_id.*,supervisor_per_division_id.supervisor_id.*"; break;
    case "users": upstreamPath = "/items/user?limit=1000"; break;
    case "divisions": upstreamPath = "/items/division"; break;
    case "salesmen": upstreamPath = "/items/salesman"; break;
    default:
      // Fallback for cases like /executives/123
      if (segment.startsWith("executives/")) upstreamPath = `/items/executive/${segment.split("/")[1]}`;
      else if (segment.startsWith("division-heads/")) upstreamPath = `/items/division_sales_head/${segment.split("/")[1]}`;
      else if (segment.startsWith("supervisors/")) upstreamPath = `/items/supervisor_per_division/${segment.split("/")[1]}`;
      else if (segment.startsWith("salesman-assignments/")) upstreamPath = `/items/salesman_per_supervisor/${segment.split("/")[1]}`;
  }

  if (!upstreamPath) {
    return NextResponse.json({ error: "Invalid proxy segment" }, { status: 400 });
  }

  const upstreamUrl = `${UPSTREAM_BASE.replace(/\/+$/, "")}${upstreamPath}${search ? search : ""}`;

  const headers = new Headers();
  headers.set("content-type", "application/json");

  const method = req.method;
  const body = ["GET", "HEAD"].includes(method) ? undefined : await req.arrayBuffer();

  try {
    const res = await fetch(upstreamUrl, {
      method,
      headers,
      body,
    });

    const data = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "application/json";

    return new NextResponse(data, {
      status: res.status,
      headers: { "content-type": contentType },
    });
  } catch (error) {
    return NextResponse.json({ error: "Proxy request failed" }, { status: 502 });
  }
}

export async function GET(req: NextRequest) { return proxy(req); }
export async function POST(req: NextRequest) { return proxy(req); }
export async function DELETE(req: NextRequest) { return proxy(req); }
export async function PATCH(req: NextRequest) { return proxy(req); }
