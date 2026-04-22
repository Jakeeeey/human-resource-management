import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * Catch-all Proxy route for Role Management module.
 * Maps local /api/hrm/employee-admin/structure/role-management/[...segment] calls to upstream database.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ segment: string[] }> }) {
  const { segment: segments } = await params;
  const segment = segments[0]; // e.g., executives
  // const id = segments[1]; // No longer used in GET

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
      upstreamPath = "/items/executive?fields=id,user_id.user_id,user_id.user_fname,user_id.user_lname,user_id.user_email,user_id.user_position,created_at,is_deleted&limit=200&filter[is_deleted][_eq]=0";
      break;
    case "review-committees":
      upstreamPath = "/items/target_setting_approver?fields=id,approver_id.user_id,approver_id.user_fname,approver_id.user_lname,approver_id.user_email,approver_id.user_position,is_deleted,created_at&limit=200&filter[is_deleted][_eq]=0";
      break;
    case "expense-review-committees":
      upstreamPath = "/items/disbursement_draft_approver?fields=id,approver_id.user_id,approver_id.user_fname,approver_id.user_lname,approver_id.user_email,approver_id.user_position,division_id.division_id,division_id.division_name,approver_heirarchy,is_deleted,created_at&limit=500&filter[is_deleted][_eq]=0";
      break;
    case "division-heads":
      upstreamPath = "/items/division_sales_head?fields=id,user_id.user_id,user_id.user_fname,user_id.user_lname,user_id.user_email,user_id.user_position,division_id.division_id,division_id.division_name,created_at,is_deleted&limit=200&filter[is_deleted][_eq]=0";
      break;
    case "supervisors":
      upstreamPath = "/items/supervisor_per_division?fields=id,supervisor_id.user_id,supervisor_id.user_fname,supervisor_id.user_lname,supervisor_id.user_email,supervisor_id.user_position,division_id.division_id,division_id.division_name,is_deleted&limit=500&filter[is_deleted][_eq]=0";
      break;
    case "salesman-assignments":
      upstreamPath = "/items/salesman_per_supervisor?fields=id,salesman_id.id,salesman_id.salesman_name,salesman_id.salesman_code,supervisor_per_division_id.id,supervisor_per_division_id.division_id.division_id,supervisor_per_division_id.division_id.division_name,supervisor_per_division_id.supervisor_id.user_id,supervisor_per_division_id.supervisor_id.user_fname,supervisor_per_division_id.supervisor_id.user_lname,is_deleted&limit=1000&filter[is_deleted][_eq]=0";
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
    case "ta-draft-approvers":
      upstreamPath = "/items/ta_draft_approvers?fields=*,department_id.*,approver_id.*&limit=500&filter[is_deleted][_eq]=0";
      break;
    case "departments":
      upstreamPath = "/items/department?fields=department_id,department_name&limit=500";
      break;
    default:
      // Fallback for sub-resources or IDs
      if (segment.startsWith("executives/")) upstreamPath = `/items/executive/${segments[1]}`;
      else if (segment.startsWith("division-heads/")) upstreamPath = `/items/division_sales_head/${segments[1]}`;
      else if (segment.startsWith("supervisors/")) upstreamPath = `/items/supervisor_per_division/${segments[1]}`;
      else if (segment.startsWith("salesman-assignments/")) upstreamPath = `/items/salesman_per_supervisor/${segments[1]}`;
      else if (segment.startsWith("review-committees/")) upstreamPath = `/items/target_setting_approver/${segments[1]}`;
      else if (segment.startsWith("expense-review-committees/")) upstreamPath = `/items/disbursement_draft_approver/${segments[1]}`;
      else if (segment.startsWith("ta-draft-approvers/")) upstreamPath = `/items/ta_draft_approvers/${segments[1]}`;
      break;
  }

  try {
    const authHeader = process.env.DIRECTUS_STATIC_TOKEN 
      ? `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` 
      : req.headers.get("Authorization") || "";

    const res = await fetch(`${UPSTREAM_BASE}${upstreamPath}${search.replace('?', '&')}`, {
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json"
      },
      cache: 'no-store'
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ segment: string[] }> }) {
  const { segment: segments } = await params;
  return handleMutation(req, segments, "POST");
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
        await Promise.all(assignmentsData.data.map((a: { id: number | string }) =>
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
    case "expense-review-committees": upstreamPath = "/items/disbursement_draft_approver"; break;
    case "division-heads": upstreamPath = "/items/division_sales_head"; break;
    case "supervisors": upstreamPath = "/items/supervisor_per_division"; break;
    case "salesman-assignments": upstreamPath = "/items/salesman_per_supervisor"; break;
    case "ta-draft-approvers": upstreamPath = "/items/ta_draft_approvers"; break;
    case "departments": upstreamPath = "/items/department"; break;
    default:
      return NextResponse.json({ error: `Invalid proxy segment: ${segment}` }, { status: 400 });
  }

  if (id) upstreamPath += `/${id}`;

  try {
    const body = method !== "DELETE" ? await req.json() : undefined;

    // For DELETE, we actually use PATCH for soft delete if it's one of our main tables
    let finalMethod = method;
    let finalBody = body;

    if (method === "POST") {
      // Extract user ID from vos_access_token cookie
      const token = req.cookies.get("vos_access_token")?.value;
      let created_by = null;
      if (token) {
        try {
          const payloadBuffer = Buffer.from(token.split('.')[1], 'base64');
          const payload = JSON.parse(payloadBuffer.toString('utf-8'));
          if (payload.sub) {
            created_by = Number(payload.sub);
          }
        } catch (e) {
          console.error("Failed to parse jwt cookie payload", e);
        }
      }

      // Generate Asia/Manila timestamp
      const phTime = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" }).replace("T", " ");

      finalBody = {
        ...finalBody,
        ...(created_by ? { created_by } : {}),
        created_at: phTime
      };
    }

    if (method === "DELETE" || (method === "PATCH" && id)) {
      // For DELETE, we actually use PATCH for soft delete
      if (method === "DELETE") {
        finalMethod = "PATCH";
        finalBody = { is_deleted: 1 };
      }

      // Inject UPDATED audit fields
      const token = req.cookies.get("vos_access_token")?.value;
      let updated_by = null;
      if (token) {
        try {
          const payloadBuffer = Buffer.from(token.split('.')[1], 'base64');
          const payload = JSON.parse(payloadBuffer.toString('utf-8'));
          if (payload.sub) {
            updated_by = Number(payload.sub);
          }
        } catch (e) {
          console.error("Failed to parse jwt cookie payload for update", e);
        }
      }

      const phTime = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" }).replace("T", " ");
      finalBody = {
        ...finalBody,
        ...(updated_by ? { updated_by } : {}),
        updated_at: phTime
      };
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
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
