import type { NextRequest } from "next/server";

import {
  authorizeEvaluationRoute,
  mapRouteError,
} from "@/modules/human-resource-management/performance-evaluation/server/evaluation-route-guards";
import { ok } from "@/modules/human-resource-management/performance-evaluation/server/evaluationApiServer";
import { listEvaluationRoster } from "@/modules/human-resource-management/performance-evaluation/server/evaluation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeEvaluationRoute(req, "canEvaluate");
    if ("failure" in auth) return auth.failure;
    const flag = req.nextUrl.searchParams.get("include_regular");
    const includeRegular = flag === "1" || flag === "true";
    return ok(
      await listEvaluationRoster(auth.cap, {
        includeRegular,
        scopeDepartmentIds: auth.cap.headScopeDepartmentIds,
      })
    );
  } catch (error) {
    return mapRouteError(error);
  }
}
