import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";
import type { RecruitmentDashboardData } from "@/modules/human-resource-management/recruitment/recruitment-dashboard/types";
import {
    fetchApplicantByStatus,
    fetchApplicantRows,
    fetchApplicantTotal,
    fetchEvaluationRows,
    fetchManpowerRows,
    fetchPipRows,
    fetchPipRowsForUser,
    fetchRecommendationRows,
    fetchTrackingRows,
} from "@/modules/human-resource-management/recruitment/recruitment-dashboard/server/queries";
import {
    buildDashboard,
    type DashboardInput,
} from "@/modules/human-resource-management/recruitment/recruitment-dashboard/server/metrics";
import { countPendingAcknowledgement } from "@/modules/human-resource-management/recruitment/recruitment-dashboard/server/probation";
import { resolveEvaluationCapability } from "@/modules/human-resource-management/performance-evaluation/admin-evaluation/server/evaluationCapability";

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
        fetchManpowerRows(),
        fetchRecommendationRows(),
        fetchTrackingRows(),
        fetchEvaluationRows(),
        fetchPipRows(),
        fetchPipRowsForUser(userId),
        resolveEvaluationCapability(userId),
    ]);

    const input: DashboardInput = {
        applicantTotal: settled(results[0], 0),
        applicantByStatus: settled(results[1], []),
        applicants: settled(results[2], []),
        manpowerRequests: settled(results[3], []),
        recommendations: settled(results[4], []),
        tracking: settled(results[5], []),
        evaluations: settled(results[6], []),
        pips: settled(results[7], []),
    };

    const data: RecruitmentDashboardData = buildDashboard(input);
    const viewerPips = settled(results[8], []);
    const capability = settled(results[9], null);
    const canViewAllEmployees = capability?.canViewAllEmployees ?? false;
    const viewerPendingPips = countPendingAcknowledgement(viewerPips);
    const queues = data.queues
        .map((tile) => (tile.key === "pip" ? { ...tile, count: viewerPendingPips } : tile))
        .filter(
            (tile) =>
                canViewAllEmployees ||
                (tile.key !== "regularization" && tile.key !== "termination_risk")
        );
    return NextResponse.json({ data: { ...data, queues } });
}
