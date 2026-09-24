import type { NextRequest } from "next/server";

import {
  authorizeEvaluationRoute,
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
    const auth = await authorizeEvaluationRoute(req, "canViewAllEmployees");
    if ("failure" in auth) return auth.failure;
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = EvaluationWorkspaceQuerySchema.safeParse(params);
    if (!query.success) {
      return validationFailed({ user_id: ["Required"] });
    }
    return ok(await getEvaluationWorkspace(query.data.user_id));
  } catch (error) {
    return mapRouteError(error);
  }
}
