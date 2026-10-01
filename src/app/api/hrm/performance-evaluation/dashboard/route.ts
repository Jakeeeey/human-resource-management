import type { NextRequest } from "next/server";

import {
    authorizeEvaluationRouteAny,
    mapRouteError,
} from "@/modules/human-resource-management/performance-evaluation/server/evaluation-route-guards";
import { ok } from "@/modules/human-resource-management/performance-evaluation/server/evaluationApiServer";
import { getPerformanceDashboard } from "@/modules/human-resource-management/performance-evaluation/server/evaluationDashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const auth = await authorizeEvaluationRouteAny(req, [
            "canViewAllEmployees",
            "canEvaluate",
        ]);
        if ("failure" in auth) return auth.failure;
        return ok(await getPerformanceDashboard(auth.cap));
    } catch (error) {
        return mapRouteError(error);
    }
}
