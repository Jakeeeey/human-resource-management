import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";
import type { RecruitmentDashboardData } from "@/modules/human-resource-management/recruitment/recruitment-dashboard/types";
import {
    fetchApplicantByStatus,
    fetchApplicantRows,
    fetchApplicantTotal,
    fetchEvaluationRows,
    fetchManpowerByStatus,
    fetchPipRows,
    fetchTrackingRows,
} from "@/modules/human-resource-management/recruitment/recruitment-dashboard/server/queries";
import {
    buildDashboard,
    type DashboardInput,
} from "@/modules/human-resource-management/recruitment/recruitment-dashboard/server/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
    return result.status === "fulfilled" ? result.value : fallback;
}

export async function GET() {
    const cookieStore = await cookies();
    const token: string | undefined = cookieStore.get(COOKIE_NAME)?.value;
    const payload = token ? decodeJwtPayload(token) : null;
    const raw = payload?.id ?? payload?.user_id ?? payload?.sub;
    const userId = typeof raw === "string" ? parseInt(raw, 10) : raw;
    if (typeof userId !== "number" || !Number.isFinite(userId)) {
        return NextResponse.json({ error: "AUTH_DENIED" }, { status: 401 });
    }

    const results = await Promise.allSettled([
        fetchApplicantTotal(),
        fetchApplicantByStatus(),
        fetchApplicantRows(),
        fetchManpowerByStatus(),
        fetchTrackingRows(),
        fetchEvaluationRows(),
        fetchPipRows(),
    ]);

    const input: DashboardInput = {
        applicantTotal: settled(results[0], 0),
        applicantByStatus: settled(results[1], []),
        applicants: settled(results[2], []),
        manpowerByStatus: settled(results[3], []),
        tracking: settled(results[4], []),
        evaluations: settled(results[5], []),
        pips: settled(results[6], []),
    };

    const data: RecruitmentDashboardData = buildDashboard(input);
    return NextResponse.json({ data });
}
