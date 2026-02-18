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
      upstreamPath = id ? `/items/executive/${id}` : "/items/executive?filter[is_deleted][_eq]=0&fields=*.*,user_id.*";
      break;
    case "review-committees":
      // Simplified fields for review committee
      upstreamPath = id ? `/items/target_setting_approver/${id}` : "/items/target_setting_approver?filter[is_deleted][_eq]=0&fields=*.*,approver_id.*";
      break;
    case "division-heads":
      upstreamPath = id ? `/items/division_sales_head/${id}` : "/items/division_sales_head?filter[is_deleted][_eq]=0&fields=*.*,division_id.*,user_id.*";
      break;
    case "supervisors":
      upstreamPath = id ? `/items/supervisor_per_division/${id}` : "/items/supervisor_per_division?filter[is_deleted][_eq]=0&fields=*.*,division_id.*,supervisor_id.*";
      break;
    case "salesman-assignments":
      upstreamPath = id ? `/items/salesman_per_supervisor/${id}` : "/items/salesman_per_supervisor?filter[is_deleted][_eq]=0&fields=*.*,salesman_id.*,supervisor_per_division_id.*,supervisor_per_division_id.supervisor_id.*";
      break;
    case "users":
      upstreamPath = "/items/user?limit=1000&fields=*.*";
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ segment: string[] }> }) {
  const { segment: segments } = await params;
  return handleMutation(req, segments, "PATCH");
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
