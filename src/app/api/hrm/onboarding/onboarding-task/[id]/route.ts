import { NextRequest, NextResponse } from "next/server";

import {
  getOnboardingTask,
  updateOnboardingTask,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboarding-task-service";
import { ONBOARDING_TASK_ERROR_CODES } from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskIo";
import {
  notFound,
  readOnboardingTaskSession,
  serverError,
  sessionActorId,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskApiServer";
import { OnboardingTaskUpdateSchema } from "@/modules/human-resource-management/onboarding/tasks/types/onboarding-task-api.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/onboarding-task/[id] — read one task (404 absent).
// PATCH /api/hrm/onboarding/onboarding-task/[id] — partial update of
// `status` / `notes` / `due_date` / `owner_user_id`. Moving the status to
// `done` stamps the completion audit; moving it back out clears it.

function invalidId() {
  return NextResponse.json(
    { success: false, message: "Invalid onboarding task id" },
    { status: 400 }
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!readOnboardingTaskSession(req)) return unauthorized();

    const { id } = await params;
    const taskId = Number(id);
    if (!Number.isInteger(taskId) || taskId <= 0) return invalidId();

    try {
      const task = await getOnboardingTask(taskId);
      return NextResponse.json({ success: true, data: task });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes(ONBOARDING_TASK_ERROR_CODES.taskNotFound)) {
        return notFound("Onboarding task not found");
      }
      throw error;
    }
  } catch (error) {
    console.error("[onboarding-task] fetch error:", error);
    return serverError();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = readOnboardingTaskSession(req);
    if (!session) return unauthorized();

    const { id } = await params;
    const taskId = Number(id);
    if (!Number.isInteger(taskId) || taskId <= 0) return invalidId();

    const body: unknown = await req.json().catch(() => null);
    const validation = OnboardingTaskUpdateSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    try {
      const task = await updateOnboardingTask({
        taskId,
        patch: validation.data,
        actorId: sessionActorId(session),
      });
      return NextResponse.json({ success: true, data: task });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes(ONBOARDING_TASK_ERROR_CODES.taskNotFound)) {
        return notFound("Onboarding task not found");
      }
      throw error;
    }
  } catch (error) {
    console.error("[onboarding-task] update error:", error);
    return serverError();
  }
}
