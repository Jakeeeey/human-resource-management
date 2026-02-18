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
    case "executives":
      upstreamPath = "/items/executive?fields=id,user_id.user_id,user_id.user_fname,user_id.user_lname,user_id.user_email,user_id.user_position,created_at,is_deleted&limit=200";
      break;
    case "review-committees":
      upstreamPath = "/items/target_setting_approver?fields=id,approver_id.user_id,approver_id.user_fname,approver_id.user_lname,approver_id.user_email,approver_id.user_position,is_deleted,created_at&limit=200";
      break;
    case "division-heads":
      upstreamPath = "/items/division_sales_head?fields=id,user_id.user_id,user_id.user_fname,user_id.user_lname,user_id.user_email,user_id.user_position,division_id.division_id,division_id.division_name,created_at,is_deleted&limit=200";
      break;
    case "supervisors":
      upstreamPath = "/items/supervisor_per_division?fields=id,supervisor_id.user_id,supervisor_id.user_fname,supervisor_id.user_lname,supervisor_id.user_email,supervisor_id.user_position,division_id.division_id,division_id.division_name,is_deleted&limit=500";
      break;
    case "salesman-assignments":
      upstreamPath = "/items/salesman_per_supervisor?fields=id,salesman_id.id,salesman_id.salesman_name,salesman_id.salesman_code,supervisor_per_division_id.id,supervisor_per_division_id.division_id.division_id,supervisor_per_division_id.division_id.division_name,supervisor_per_division_id.supervisor_id.user_id,supervisor_per_division_id.supervisor_id.user_fname,supervisor_per_division_id.supervisor_id.user_lname,is_deleted&limit=1000";
      break;
    case "users":
      upstreamPath = "/items/user?fields=user_id,user_fname,user_mname,user_lname,user_email,user_position&limit=500";
      break;
    case "divisions":
      upstreamPath = "/items/division?fields=division_id,division_name,division_code&limit=200";
      break;
    case "salesmen":
      upstreamPath = "/items/salesman?fields=id,salesman_name,salesman_code&limit=500";
      break;
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

    // Cascade: if deleting a supervisor_per_division record,
    // also soft-delete all salesman_per_supervisor rows that belong to it.
    if (segments[0] === "supervisors" && segments[1]) {
      const supervisorPerDivisionId = segments[1];
      const base = UPSTREAM_BASE!.replace(/\/+$/, "");

      try {
        // Step 1: Fetch all active salesman_per_supervisor rows for this supervisor_per_division_id
        const fetchUrl = `${base}/items/salesman_per_supervisor?filter[supervisor_per_division_id][_eq]=${supervisorPerDivisionId}&filter[is_deleted][_eq]=0&fields=id&limit=-1`;
        console.log(`[Proxy] CASCADE: fetching salesmen for supervisor_per_division_id=${supervisorPerDivisionId}`);
        const fetchRes = await fetch(fetchUrl, {
          method: "GET",
          headers: { "content-type": "application/json" },
        });

        if (fetchRes.ok) {
          const fetchJson = await fetchRes.json();
          const salesmanRows: { id: number }[] = fetchJson.data ?? fetchJson ?? [];
          const ids = salesmanRows.map((r) => r.id);

          if (ids.length > 0) {
            // Step 2: Bulk soft-delete using Directus array-body PATCH
            // Format: PATCH /items/salesman_per_supervisor  body: [{ id, is_deleted: 1 }, ...]
            const bulkBody = ids.map((id) => ({ id, is_deleted: 1 }));
            console.log(`[Proxy] CASCADE: soft-deleting ${ids.length} salesman assignment(s): [${ids.join(", ")}]`);
            await fetch(`${base}/items/salesman_per_supervisor`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(bulkBody),
            });
          } else {
            console.log(`[Proxy] CASCADE: no active salesman assignments found for supervisor_per_division_id=${supervisorPerDivisionId}`);
          }
        } else {
          console.warn(`[Proxy] CASCADE: failed to fetch salesman assignments (status ${fetchRes.status})`);
        }
      } catch (cascadeError) {
        console.error(`[Proxy] Cascade soft-delete failed:`, cascadeError);
        // Non-fatal: still proceed with the supervisor soft-delete
      }
    }
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
