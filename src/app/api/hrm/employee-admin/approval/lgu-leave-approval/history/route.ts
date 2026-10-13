import { NextRequest, NextResponse } from "next/server";
import { LguLeaveApprovalService } from "@/modules/human-resource-management/employee-admin/approval/lgu-leave-approval/services/lguLeaveApprovalService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestId = Number(searchParams.get("requestId"));

    if (!requestId) {
      return NextResponse.json(
        { ok: false, error: "Missing requestId parameter" },
        { status: 400 }
      );
    }

    const history = await LguLeaveApprovalService.fetchHistory(requestId);

    return NextResponse.json({
      ok: true,
      data: history,
    });
  } catch (error) {
    console.error("GET /api/hrm/employee-admin/approval/lgu-leave-approval/history error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch approval history" },
      { status: 500 }
    );
  }
}
