import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { dispatchMail } from "@/modules/human-resource-management/recruitment/mailing/utils/dispatchMail";
import { logRedacted } from "@/modules/human-resource-management/recruitment/mailing/utils/mailLog";
import {
  buildEmployeeCompletionDispatchCtx,
  isCompletionReady,
  missingChecklistItems,
  runCompletionChecklist,
  type ChecklistItem,
} from "@/modules/human-resource-management/onboarding/completion/completionChecklist";
import { listOnboardingTasks } from "@/modules/human-resource-management/onboarding/tasks/server/onboarding-task-service";
import { listOnboardingTaskTemplates } from "@/modules/human-resource-management/onboarding/tasks/server/task-template-service";
import {
  readOnboardingTaskSession,
  serverError,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskApiServer";
import type { OnboardingTask } from "@/modules/human-resource-management/onboarding/types/onboarding-task.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET|POST /api/hrm/onboarding/completion — the employee task-set completion
// orchestrator (todo 22). Completion is DERIVED from the employee's
// `onboarding_task` rows: ready iff every required task is satisfied
// (done / na). The terminal state IS the task set — there is no
// `onboarding_profiles` read or write anywhere on this path, and no legacy
// status vocabulary.
//
// - EMPLOYEE KEY: `user_id` (user.user_id) replaces the retired
//   `profile_id` scope; an unknown employee answers 400 with NO writes.
// - GET re-reads the checklist + the raw task rows (re-check, never writes).
// - POST re-verifies: partial -> 422 listing the exact missing tasks (the
//   refuse-with-list payload); ready -> success, and the single
//   `onboarding.completed` notification fires (dedup-keyed per employee;
//   never awaited, never throws).
// - The only writes on this path belong to the task engine (task
//   PATCH/complete routes) — this route writes NOTHING.

const completionQuerySchema = z
  .object({
    user_id: z.coerce.number().int().positive(),
  })
  .strict();

const completionBodySchema = z
  .object({
    user_id: z.coerce.number().int().positive(),
  })
  .strict();

/** `user_id` is signed INT; `user_email` is the optional notification
 *  recipient (an employee without one simply records a skipped dispatch). */
const EmployeeRowSchema = z.object({
  user_id: z.number().int().positive(),
  user_email: z.string().nullable().optional(),
});

interface CompletionEmployee {
  user_id: number;
  user_email: string | null;
}

interface CompletionSnapshot {
  employee: CompletionEmployee;
  tasks: OnboardingTask[];
  checklist: ChecklistItem[];
  ready: boolean;
  missing: ChecklistItem[];
}

function employeeNotFound(): NextResponse {
  return NextResponse.json(
    { success: false, message: "The employee does not exist" },
    { status: 400 }
  );
}

/**
 * Reads the scratch-safe employee row (existence + notification email).
 * @returns The employee, or null when the row does not exist.
 * @throws Coded error when the lookup itself fails (never a false "missing").
 */
async function readEmployee(userId: number): Promise<CompletionEmployee | null> {
  const body: unknown = await dFetch(
    `/items/user?filter[user_id][_eq]=${userId}&fields=user_id,user_email&limit=1`
  );
  const parsed = z.object({ data: z.array(EmployeeRowSchema) }).safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `COMPLETION_USER_READ_FAILED: user ${userId} lookup failed (${JSON.stringify(body).slice(0, 300)})`
    );
  }
  const row = parsed.data.data[0];
  if (!row) return null;
  const email =
    typeof row.user_email === "string" && row.user_email.trim().length > 0
      ? row.user_email.trim()
      : null;
  return { user_id: row.user_id, user_email: email };
}

/**
 * Gathers the employee + task set + catalog and derives the checklist.
 * @returns The snapshot, or null when the employee does not exist.
 */
async function gatherCompletion(
  userId: number
): Promise<CompletionSnapshot | null> {
  const [employee, tasks, templates] = await Promise.all([
    readEmployee(userId),
    listOnboardingTasks({ userId }),
    listOnboardingTaskTemplates(),
  ]);
  if (!employee) return null;

  const checklist = runCompletionChecklist({ tasks, templates });
  return {
    employee,
    tasks,
    checklist,
    ready: isCompletionReady(checklist),
    missing: missingChecklistItems(checklist),
  };
}

function blockedMessage(missing: readonly ChecklistItem[]): string {
  if (missing.length > 0) {
    return `Completion blocked: ${missing.length} required task(s) still open`;
  }
  return "Completion blocked: no required onboarding tasks are materialized for this employee";
}

// GET /api/hrm/onboarding/completion?user_id= — re-check without writing.
export async function GET(req: NextRequest) {
  try {
    if (!readOnboardingTaskSession(req)) return unauthorized();

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = completionQuerySchema.safeParse(params);
    if (!query.success) {
      return validationFailed(query.error.flatten().fieldErrors);
    }

    const snapshot = await gatherCompletion(query.data.user_id);
    if (!snapshot) return employeeNotFound();

    return NextResponse.json({
      success: true,
      data: {
        user: snapshot.employee,
        tasks: snapshot.tasks,
        checklist: snapshot.checklist,
        ready: snapshot.ready,
        missing: snapshot.missing,
      },
    });
  } catch (error) {
    console.error("[onboarding-completion] check error:", error);
    return serverError();
  }
}

// POST /api/hrm/onboarding/completion — verify-all-first, then report.
export async function POST(req: NextRequest) {
  try {
    if (!readOnboardingTaskSession(req)) return unauthorized();

    const body: unknown = await req.json().catch(() => null);
    const validation = completionBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }
    const userId = validation.data.user_id;

    const snapshot = await gatherCompletion(userId);
    if (!snapshot) return employeeNotFound();

    if (!snapshot.ready) {
      // Refused with the exact missing-task list — nothing written, nothing sent.
      return NextResponse.json(
        {
          success: false,
          message: blockedMessage(snapshot.missing),
          data: {
            user: snapshot.employee,
            tasks: snapshot.tasks,
            checklist: snapshot.checklist,
            ready: false,
            missing: snapshot.missing,
          },
        },
        { status: 422 }
      );
    }

    // Notify ONLY on the verified completion; the employee-scoped dedup key
    // collapses re-fires (first call records the outbox row, later ones
    // answer `duplicate`). Never awaited, never throws.
    void dispatchMail(
      "onboarding.completed",
      buildEmployeeCompletionDispatchCtx({
        userId,
        toEmail: snapshot.employee.user_email,
      })
    ).catch(logRedacted);

    return NextResponse.json({
      success: true,
      data: {
        user: snapshot.employee,
        tasks: snapshot.tasks,
        checklist: snapshot.checklist,
        ready: true,
        missing: [],
      },
      message: "Onboarding complete — every required onboarding task is done",
    });
  } catch (error) {
    console.error("[onboarding-completion] complete error:", error);
    return serverError();
  }
}
