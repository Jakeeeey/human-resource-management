import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { LguLeaveApprovalService } from "@/modules/human-resource-management/employee-admin/approval/lgu-leave-approval/services/lguLeaveApprovalService";
import { LguLeaveActionPayload } from "@/modules/human-resource-management/employee-admin/approval/lgu-leave-approval/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const COOKIE_NAME = "vos_access_token";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const p = parts[1];
    const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken();
    const payload = token ? decodeJwtPayload(token) : null;

    // Default mock user if dev/testing without active token
    const userId = Number(payload?.id || payload?.user_id || payload?.sub || 1);
    const isAdmin =
      payload?.isAdmin === true ||
      payload?.role === "Administrator" ||
      payload?.role_name === "Administrator" ||
      !token; // allow testing in dev if no token

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const departmentId = searchParams.get("departmentId") || undefined;
    const leaveType = searchParams.get("leaveType") || undefined;
    const search = searchParams.get("search") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const result = await LguLeaveApprovalService.fetchRequests(userId, isAdmin, {
      status,
      departmentId,
      leaveType,
      search,
      startDate,
      endDate,
    });

    const userName = [
      payload?.first_name || payload?.user_fname || "Hon.",
      payload?.last_name || payload?.user_lname || "Approver",
    ].join(" ");

    return NextResponse.json({
      ok: true,
      data: result.data,
      total: result.total,
      userRole: {
        userId,
        userName,
        isAdmin,
      },
    });
  } catch (error) {
    console.error("GET /api/hrm/employee-admin/approval/lgu-leave-approval error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch LGU leave approval requests" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = await getAuthToken();
    const payload = token ? decodeJwtPayload(token) : null;

    const actorId = Number(payload?.id || payload?.user_id || payload?.sub || 1);
    const actorName = [
      payload?.first_name || payload?.user_fname || "Approving",
      payload?.last_name || payload?.user_lname || "Officer",
    ]
      .filter(Boolean)
      .join(" ");

    const isAdmin =
      payload?.isAdmin === true ||
      payload?.role === "Administrator" ||
      !token;

    const body: LguLeaveActionPayload = await request.json();

    if (!body || !body.type) {
      return NextResponse.json(
        { ok: false, error: "Invalid action payload. Missing action type." },
        { status: 400 }
      );
    }

    const result = await LguLeaveApprovalService.processAction(
      body,
      actorId,
      actorName,
      isAdmin
    );

    return NextResponse.json({
      ok: true,
      message: result.message,
      data: result.updated,
    });
  } catch (error) {
    console.error("PATCH /api/hrm/employee-admin/approval/lgu-leave-approval error:", error);
    const message = error instanceof Error ? error.message : "Failed to process leave action";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
