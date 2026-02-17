import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const UPSTREAM_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * Catch-all Proxy route for Role Management module.
 * Maps local /api/hrm/employee-admin/structure/role-management/[...segment] calls to upstream database.
 */
async function proxy(req: NextRequest, context: { params: Promise<{ segment: string[] }> }) {
  const { segment: segments } = await context.params;
  const segment = segments.join("/");
  const url = new URL(req.url);
  const { search } = url;

  if (!UPSTREAM_BASE) {
    return NextResponse.json({ error: "Upstream API base not configured" }, { status: 500 });
  }

  // Map segments to upstream endpoints
  let upstreamPath = "";
  const isListRequest = !segments[1]; // e.g., /executives vs /executives/1

  switch (segment) {
    case "executives": upstreamPath = "/items/executive?fields=*.*"; break;
    case "review-committees": upstreamPath = "/items/target_setting_approver?fields=*.*,approver_id.*"; break;
    case "division-heads": upstreamPath = "/items/division_sales_head?fields=*.*,user_id.*,division_id.*"; break;
    case "supervisors": upstreamPath = "/items/supervisor_per_division?fields=*.*,supervisor_id.*,division_id.*"; break;
    case "salesman-assignments": upstreamPath = "/items/salesman_per_supervisor?fields=*.*,salesman_id.*,supervisor_per_division_id.*,supervisor_per_division_id.supervisor_id.*"; break;
    case "users": upstreamPath = "/items/user?limit=1000"; break;
    case "divisions": upstreamPath = "/items/division"; break;
    case "salesmen": upstreamPath = "/items/salesman"; break;
    default:
      // Fallback for sub-resources or IDs
      if (segment.startsWith("executives/")) upstreamPath = `/items/executive/${segments[1]}`;
      else if (segment.startsWith("division-heads/")) upstreamPath = `/items/division_sales_head/${segments[1]}`;
      else if (segment.startsWith("supervisors/")) upstreamPath = `/items/supervisor_per_division/${segments[1]}`;
      else if (segment.startsWith("salesman-assignments/")) upstreamPath = `/items/salesman_per_supervisor/${segments[1]}`;
      else if (segment.startsWith("review-committees/")) upstreamPath = `/items/target_setting_approver/${segments[1]}`;
      break;
  }

  if (!upstreamPath) {
    return NextResponse.json({ error: `Invalid proxy segment: ${segment}` }, { status: 400 });
  }

  // Implementation of Soft Delete (Audit Trail)
  let method = req.method;
  let body: any = undefined;

  // 1. Convert DELETE to PATCH for soft delete
  if (method === "DELETE") {
    method = "PATCH";
    body = JSON.stringify({ is_deleted: 1 });
  } else {
    body = ["GET", "HEAD"].includes(method) ? undefined : await req.arrayBuffer();
  }

  // 2. Add filter for GET requests to exclude deleted items
  if (method === "GET" && isListRequest && !["users", "divisions", "salesmen"].includes(segment)) {
    const separator = upstreamPath.includes("?") ? "&" : "?";
    upstreamPath += `${separator}filter[is_deleted][_eq]=0`;
  }

  const upstreamUrl = `${UPSTREAM_BASE.replace(/\/+$/, "")}${upstreamPath}${search ? (upstreamPath.includes("?") ? search.replace("?", "&") : search) : ""}`;

  const headers = new Headers();
  headers.set("content-type", "application/json");

  try {
    console.log(`[Proxy] ${req.method}${req.method !== method ? ` -> ${method}` : ""} ${url.pathname} -> ${upstreamUrl}`);
    const res = await fetch(upstreamUrl, {
      method,
      headers,
      body,
    });

    console.log(`[Proxy] Upstream responded with status: ${res.status}`);

    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const data = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "application/json";

    return new NextResponse(data, {
      status: res.status,
      headers: { "content-type": contentType },
    });
  } catch (error) {
    console.error(`[Proxy] Error:`, error);
    return NextResponse.json({ error: "Proxy request failed" }, { status: 502 });
  }
}

export async function GET(req: NextRequest, context: any) { return proxy(req, context); }
export async function POST(req: NextRequest, context: any) { return proxy(req, context); }
export async function DELETE(req: NextRequest, context: any) { return proxy(req, context); }
export async function PATCH(req: NextRequest, context: any) { return proxy(req, context); }
