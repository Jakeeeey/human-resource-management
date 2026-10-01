import type { NextRequest } from "next/server";

import {
  authorizeEvaluationRoute,
  EvaluationWorkspaceQuerySchema,
  mapRouteError,
} from "@/modules/human-resource-management/performance-evaluation/admin-evaluation/server/evaluation-route-guards";
import {
  ok,
  validationFailed,
} from "@/modules/human-resource-management/performance-evaluation/admin-evaluation/server/evaluationApiServer";
import { getEvaluationWorkspace } from "@/modules/human-resource-management/performance-evaluation/admin-evaluation/server/workspaceService";

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
