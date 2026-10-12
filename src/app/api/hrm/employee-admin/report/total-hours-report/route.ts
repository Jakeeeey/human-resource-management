import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";
import { fetchTotalHoursReport } from "@/modules/human-resource-management/employee-admin/report/total-hours-report/services/totalHoursReportService";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: No valid session token" },
        { status: 401 }
      );
    }

    const payload = decodeJwtPayload(token);
    const userId = Number(payload?.id || payload?.user_id || payload?.sub);

    if (!userId || isNaN(userId)) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid token subject" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10));
    const search = searchParams.get("search") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";
    const departmentId = searchParams.get("departmentId") || null;
    const nameFilter = searchParams.get("nameFilter") || "";
    const approvalStatus = searchParams.get("approvalStatus") || "approved";

    const reportResult = await fetchTotalHoursReport({
      userId,
      userRole: payload?.role as string | undefined,
      isAdminUser: payload?.role === "ADMIN",
      page,
      pageSize,
      search,
      dateFrom,
      dateTo,
      departmentId,
      nameFilter,
      approvalStatus,
    });

    return NextResponse.json(reportResult);
  } catch (error: unknown) {
    console.error("GET Total Hours Report error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: "Failed to fetch total hours report", details: message },
      { status: 500 }
    );
  }
}
