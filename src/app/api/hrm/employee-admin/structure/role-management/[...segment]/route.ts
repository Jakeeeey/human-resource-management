import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const UPSTREAM_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * Catch-all Proxy route for Role Management module.
 * Maps local /api/hrm/employee-admin/structure/role-management/[...segment] calls to upstream database.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ segment: string[] }> }) {
  const { segment: segments } = await params;
  const segment = segments[0]; // e.g., executives
  const id = segments[1];      // e.g., 5

  if (!UPSTREAM_BASE) {
    return NextResponse.json({ error: "Upstream API base not configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const search = url.search;

  // Map segments to upstream endpoints
  let upstreamPath = "";

  // Specific field selection for better performance
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
    case "divisions":
      upstreamPath = "/items/division?limit=100&fields=*.*";
      break;
    case "salesmen":
      upstreamPath = "/items/salesman?limit=1000&fields=*.*";
      break;
    default:
      return NextResponse.json({ error: `Invalid proxy segment: ${segment}` }, { status: 400 });
  }

  try {
    const res = await fetch(`${UPSTREAM_BASE}${upstreamPath}${search.replace('?', '&')}`, {
      headers: {
        "Authorization": req.headers.get("Authorization") || "",
        "Content-Type": "application/json"
      },
      cache: 'no-store'
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ segment: string[] }> }) {
  const { segment: segments } = await params;
  return handleMutation(req, segments, "POST");
}

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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ segment: string[] }> }) {
  const { segment: segments } = await params;

  // Implementation of Cascade Soft Delete for Supervisors
  // If we delete a supervisor, we must also delete all salesman assignments under them
  if (req.method === "DELETE" && segments[0] === "supervisors" && segments[1]) {
    try {
      const supervisorId = segments[1];

      // 1. Find all active salesman assignments for this supervisor assignment
      const assignmentsRes = await fetch(`${UPSTREAM_BASE}/items/salesman_per_supervisor?filter[supervisor_per_division_id][_eq]=${supervisorId}&filter[is_deleted][_eq]=0&fields=id`, {
        headers: { "Authorization": req.headers.get("Authorization") || "" }
      });
      const assignmentsData = await assignmentsRes.json();

      if (assignmentsData.data && assignmentsData.data.length > 0) {
        // 2. Soft delete them
        await Promise.all(assignmentsData.data.map((a: any) =>
          fetch(`${UPSTREAM_BASE}/items/salesman_per_supervisor/${a.id}`, {
            method: "PATCH",
            headers: {
              "Authorization": req.headers.get("Authorization") || "",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ is_deleted: 1 })
          })
        ));
      }
    } catch (e) {
      console.error("Failed to cascade delete salesman assignments", e);
      // We continue to delete the supervisor even if cascade fails
    }
  }

  return handleMutation(req, segments, "DELETE");
}

async function handleMutation(req: NextRequest, segments: string[], method: string) {
  const segment = segments[0];
  const id = segments[1];

  let upstreamPath = "";
  switch (segment) {
    case "executives": upstreamPath = "/items/executive"; break;
    case "review-committees": upstreamPath = "/items/target_setting_approver"; break;
    case "division-heads": upstreamPath = "/items/division_sales_head"; break;
    case "supervisors": upstreamPath = "/items/supervisor_per_division"; break;
    case "salesman-assignments": upstreamPath = "/items/salesman_per_supervisor"; break;
    default:
      return NextResponse.json({ error: `Invalid proxy segment: ${segment}` }, { status: 400 });
  }

  if (id) upstreamPath += `/${id}`;

  try {
    const body = method !== "DELETE" ? await req.json() : undefined;

    // For DELETE, we actually use PATCH for soft delete if it's one of our main tables
    let finalMethod = method;
    let finalBody = body;

    if (method === "DELETE") {
      finalMethod = "PATCH";
      finalBody = { is_deleted: 1 };
    }

    const res = await fetch(`${UPSTREAM_BASE}${upstreamPath}`, {
      method: finalMethod,
      headers: {
        "Authorization": req.headers.get("Authorization") || "",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(finalBody)
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json(err, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
