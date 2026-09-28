import type { NextRequest } from "next/server";

import {
  authorizeEvaluationRoute,
  enforceDepartmentScope,
  EvaluationWorkspaceQuerySchema,
  mapRouteError,
} from "@/modules/human-resource-management/performance-evaluation/server/evaluation-route-guards";
import {
  ok,
  validationFailed,
} from "@/modules/human-resource-management/performance-evaluation/server/evaluationApiServer";
import { getEvaluationWorkspace } from "@/modules/human-resource-management/performance-evaluation/server/evaluation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeEvaluationRoute(req, "canEvaluate");
    if ("failure" in auth) return auth.failure;
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = EvaluationWorkspaceQuerySchema.safeParse(params);
    if (!query.success) {
      return validationFailed({ user_id: ["Required"] });
    }
    await enforceDepartmentScope(
      query.data.user_id,
      auth.cap.headScopeDepartmentIds,
      "headScopeDepartmentIds"
    );
    return ok(await getEvaluationWorkspace(query.data.user_id));
  } catch (error) {
    return mapRouteError(error);
  }
}
