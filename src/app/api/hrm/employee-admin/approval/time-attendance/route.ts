import { NextRequest, NextResponse } from "next/server";
import { TAApprovalService } from "@/modules/human-resource-management/employee-admin/approval/time-attendance/services/time-attendance.service";
import { RequestStatus, RequestType } from "@/modules/human-resource-management/employee-admin/approval/time-attendance/types";
import { TAActionPayloadSchema } from "@/modules/human-resource-management/employee-admin/approval/time-attendance/types/time-attendance.schema";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";

/**
 * Resolves the authenticated user's numeric ID from the vos_access_token JWT cookie.
 * The JWT `sub` claim stores the user ID as a string.
 */
function getAuthUserId(req: NextRequest): number | null {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload?.sub) return null;
  const parsed = Number(payload.sub);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * GET  /api/hrm/employee-admin/approval/time-attendance
 *
 *  ?action=history&requestId=X&type=Y  → approval audit history for a request
 *  ?userId=<n>                          → requests filed BY the current user
 *  (default)                            → manager queue for the cookie-authed user
 *
 *  Optional filters: status, types (csv), startDate, endDate
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // ── Resolve the authenticated approver from the cookie ──────────────────
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: missing or invalid session token" },
        { status: 401 }
      );
    }



    // ── Resolve HR Head status early (used in multiple branches) ─────────────
    const isHRHead = await TAApprovalService.isHRDepartmentHead(authUserId);

    // ── Parse shared filters ─────────────────────────────────────────────────
    const filters = {
      status: (searchParams.get("status") as RequestStatus) || undefined,
      types: (searchParams.get("types")?.split(",") as RequestType[]) || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      departmentId: searchParams.get("departmentId") ? Number(searchParams.get("departmentId")) : undefined,
    };

    // ── Branch: fetch departments (scoped to user assignments if not HR Head) ──
    if (searchParams.get("action") === "departments") {
      const data = isHRHead 
        ? await TAApprovalService.fetchAllDepartments()
        : await TAApprovalService.fetchAssignedDepartments(authUserId);
      return NextResponse.json({ success: true, data });
    }

    // ── Branch: fetch audit history for one request ──────────────────────────
    if (searchParams.get("action") === "history") {
      const requestId = searchParams.get("requestId");
      const type = searchParams.get("type");
      if (!requestId || !type) {
        return NextResponse.json(
          { success: false, error: "Missing requestId or type" },
          { status: 400 }
        );
      }
      const data = await TAApprovalService.fetchDetailedHistory(
        Number(requestId),
        type as RequestType
      );
      return NextResponse.json({ success: true, data });
    }

    // ── Branch: all history logs ─────────────────────────────────────────────
    if (searchParams.get("action") === "logs") {
      const limit = Number(searchParams.get("limit") || "100");
      const data = await TAApprovalService.fetchApproverLogs(authUserId, limit, isHRHead, filters);

      return NextResponse.json({ success: true, data });
    }

    // ── Branch: requests filed BY the current user ("My Submissions") ─────────
    if (searchParams.get("mode") === "mine") {
      const data = await TAApprovalService.fetchMyRequests(authUserId, filters);

      return NextResponse.json({ success: true, data });
    }

    // ── Default: manager approval queue ──────────────────────────────────────
    const data = await TAApprovalService.fetchManagerQueue(authUserId, filters, isHRHead);
    

    
    return NextResponse.json({ 
      success: true, 
      data,
      isHRHead
    });
  } catch (error: unknown) {
    console.error("[TAApproval API] GET error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 }
    );
  }
}

/**
 * POST  /api/hrm/employee-admin/approval/time-attendance
 * Body: { requestId, type, action, remarks }
 * The current approver's ID is resolved from the cookie — never trusted from the client.
 */
export async function POST(req: NextRequest) {
  try {
    // ── Resolve approver from cookie ─────────────────────────────────────────
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: missing or invalid session token" },
        { status: 401 }
      );
    }

    const body = await req.json();

    // ── Validate action payload ───────────────────────────────────────────────
    const validated = TAActionPayloadSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid payload",
          details: validated.error.format(),
        },
        { status: 400 }
      );
    }

    const result = await TAApprovalService.processAction(
      validated.data,
      authUserId
    );
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[TAApproval API] POST error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 }
    );
  }
}
