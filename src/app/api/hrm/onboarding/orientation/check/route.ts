import { NextRequest, NextResponse } from "next/server";

import {
  ORIENTATION_ERROR_CODES,
  checkOffOrientationTopic,
} from "@/modules/human-resource-management/onboarding/orientation/orientation-task-service";
import { CheckOffOrientationSchema } from "@/modules/human-resource-management/onboarding/orientation/types/orientation.schema";
import {
  notFound,
  readOnboardingTaskSession,
  serverError,
  sessionActorId,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskApiServer";
import { ONBOARDING_TASK_ERROR_CODES } from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskIo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/hrm/onboarding/orientation/check — check off one orientation topic
// for one employee. Body `{ user_id, topic_id }` (strict); the actor is the
// session `sub` (`completed_by`), never client-asserted. Unknown topic or a
// topic with no orientation task row for that employee -> 404 with NO writes
// (the ownership gate); unknown employee -> 400; no session -> 401.

export async function POST(req: NextRequest) {
  try {
    const session = readOnboardingTaskSession(req);
    if (!session) return unauthorized();

    const body: unknown = await req.json().catch(() => null);
    const validation = CheckOffOrientationSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    try {
      const result = await checkOffOrientationTopic({
        userId: validation.data.user_id,
        topicId: validation.data.topic_id,
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
      if (
        message.includes(ORIENTATION_ERROR_CODES.topicNotFound) ||
        message.includes(ORIENTATION_ERROR_CODES.taskNotFound)
      ) {
        return notFound(
          "The orientation topic is not part of this employee's task set"
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("[onboarding-orientation] check error:", error);
    return serverError();
  }
}
