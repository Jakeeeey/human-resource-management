
import { NextRequest, NextResponse } from "next/server";
import { DashboardService } from "@/modules/human-resource-management/manufacturing/dashboard/services/DashboardService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get("start_date");
        const endDate = searchParams.get("end_date");
        const lineId = searchParams.get("line_id");

        if (!startDate || !endDate) {
            return NextResponse.json({ error: "start_date and end_date are required" }, { status: 400 });
        }

        const stats = await DashboardService.getDashboardStats(startDate, endDate, lineId);
        return NextResponse.json(stats);
    } catch (error) {
        const err = error as Error;
        console.error("[Dashboard API] Error:", err.message);
        return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
    }
}
