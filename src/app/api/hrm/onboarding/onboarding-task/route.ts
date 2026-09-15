import { NextRequest, NextResponse } from "next/server";

import {
  listOnboardingTasks,
  materializeOnboardingTasks,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboarding-task-service";
import { ONBOARDING_TASK_ERROR_CODES } from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskIo";
import {
  readOnboardingTaskSession,
  serverError,
  sessionActorId,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskApiServer";
import {
  MaterializeOnboardingTasksSchema,
  OnboardingTaskListQuerySchema,
} from "@/modules/human-resource-management/onboarding/tasks/types/onboarding-task-api.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/onboarding-task?user_id=&status=&owner_role=
//   Lists the employee's `onboarding_task` rows. Keyed to `user_id` — there
//   is no profile scope.
// POST /api/hrm/onboarding/onboarding-task  body `{ user_id }`
//   Materializes every missing task for the employee from the seeded catalog
//   (idempotent). An unknown employee answers 400 with NO writes; a repeat
//   call creates zero rows.
// Server-side only: the Directus token never reaches the browser.

export async function GET(req: NextRequest) {
  try {
    if (!readOnboardingTaskSession(req)) return unauthorized();

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = OnboardingTaskListQuerySchema.safeParse(params);
    if (!query.success) {
      return validationFailed(query.error.flatten().fieldErrors);
    }

    const rows = await listOnboardingTasks({
      userId: query.data.user_id,
      status: query.data.status,
      ownerRole: query.data.owner_role,
    });
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("[onboarding-task] list error:", error);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = readOnboardingTaskSession(req);
    if (!session) return unauthorized();

    const body: unknown = await req.json().catch(() => null);
    const validation = MaterializeOnboardingTasksSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    try {
      const result = await materializeOnboardingTasks({
        userId: validation.data.user_id,
        actorId: sessionActorId(session),
      });
      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes(ONBOARDING_TASK_ERROR_CODES.userNotFound)) {
        return NextResponse.json(
          { success: false, message: "The employee does not exist" },
          { status: 400 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("[onboarding-task] materialize error:", error);
    return serverError();
  }
}
