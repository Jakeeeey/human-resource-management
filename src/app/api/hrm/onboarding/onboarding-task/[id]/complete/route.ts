import { NextRequest, NextResponse } from "next/server";

import { completeOnboardingTask } from "@/modules/human-resource-management/onboarding/tasks/server/onboarding-task-service";
import { ONBOARDING_TASK_ERROR_CODES } from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskIo";
import {
  notFound,
  readOnboardingTaskSession,
  serverError,
  sessionActorId,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskApiServer";
import { OnboardingTaskCompleteSchema } from "@/modules/human-resource-management/onboarding/tasks/types/onboarding-task-api.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/hrm/onboarding/onboarding-task/[id]/complete — marks the task
// `done` with `completed_by` (session `sub`) + `completed_at` (PH time).
// Re-completing is an idempotent no-op (`alreadyDone: true`, timestamps
// unchanged). The body is a strict empty object — the actor is never
// client-asserted.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = readOnboardingTaskSession(req);
    if (!session) return unauthorized();

    const { id } = await params;
    const taskId = Number(id);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid onboarding task id" },
        { status: 400 }
      );
    }

    const body: unknown = await req.json().catch(() => null);
    const validation = OnboardingTaskCompleteSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    try {
      const result = await completeOnboardingTask({
        taskId,
        completedBy: sessionActorId(session),
      });
      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes(ONBOARDING_TASK_ERROR_CODES.taskNotFound)) {
        return notFound("Onboarding task not found");
      }
      throw error;
    }
  } catch (error) {
    console.error("[onboarding-task] complete error:", error);
    return serverError();
  }
}
