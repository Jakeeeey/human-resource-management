import { NextRequest, NextResponse } from "next/server";

import { backfillOnboardingTasks } from "@/modules/human-resource-management/onboarding/tasks/server/onboarding-task-backfill-service";
import {
  readOnboardingTaskSession,
  serverError,
  sessionActorId,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskApiServer";
import { BackfillOnboardingTasksSchema } from "@/modules/human-resource-management/onboarding/tasks/types/onboarding-task-api.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/hrm/onboarding/onboarding-task/backfill
//   Maintenance sweep for employees who already own `onboarding_task` rows:
//   deactivates retired `training_assigned` / `training_completed` template
//   rows, materializes every missing task via the same idempotent engine
//   the hire flow uses (narrowed to the employee's department), and closes
//   open `access_provisioned` tasks. Safe to re-run — a second call creates
//   zero tasks, patches zero templates, and completes zero access rows.
//   One employee's failure is reported in `errors` without aborting the run.
// Body is a strict EMPTY object (`{}`); the actor comes from the session.

export async function POST(req: NextRequest) {
  try {
    const session = readOnboardingTaskSession(req);
    if (!session) return unauthorized();

    const body: unknown = await req.json().catch(() => null);
    const validation = BackfillOnboardingTasksSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const result = await backfillOnboardingTasks({
      actorId: sessionActorId(session),
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[onboarding-task] backfill error:", error);
    return serverError();
  }
}
