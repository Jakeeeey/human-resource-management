import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getOrientationState,
  listOrientationEmployees,
} from "@/modules/human-resource-management/onboarding/orientation/orientation-task-service";
import {
  readOnboardingTaskSession,
  serverError,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskApiServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/orientation              -> employee roster
// GET /api/hrm/onboarding/orientation?user_id=     -> per-employee state
//   (topics + employee-keyed checks + done predicate). Employee-scoped since
//   todo 20 — there is no profile_id parameter. Session-gated server-side; the
//   Directus token never reaches the browser.

const stateQuerySchema = z
  .object({
    user_id: z.coerce.number().int().positive().optional(),
  })
  .strict();

export async function GET(req: NextRequest) {
  try {
    if (!readOnboardingTaskSession(req)) return unauthorized();

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = stateQuerySchema.safeParse(params);
    if (!query.success) {
      return validationFailed(query.error.flatten().fieldErrors);
    }

    if (query.data.user_id === undefined) {
      const employees = await listOrientationEmployees();
      return NextResponse.json({ success: true, data: { employees } });
    }

    const state = await getOrientationState(query.data.user_id);
    return NextResponse.json({ success: true, data: state });
  } catch (error) {
    console.error("[onboarding-orientation] state error:", error);
    return serverError();
  }
}
