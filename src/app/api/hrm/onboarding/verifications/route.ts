import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  dispatchMail,
  type DispatchCtx,
} from "@/modules/human-resource-management/recruitment/mailing/utils/dispatchMail";
import { logRedacted } from "@/modules/human-resource-management/recruitment/mailing/utils/mailLog";
import { buildCompletionDedupKey } from "@/modules/human-resource-management/onboarding/completion/completionChecklist";
import {
  completeOnboardingTask,
  listOnboardingTasks,
  updateOnboardingTask,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboarding-task-service";
import {
  readOnboardingTaskSession,
  sessionActorId,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskApiServer";
import { listOnboardingTaskTemplates } from "@/modules/human-resource-management/onboarding/tasks/server/task-template-service";
import type { AcknowledgementLog } from "@/modules/human-resource-management/onboarding/verification/types/acknowledgement-log.schema";
import {
  aggregateQueue,
  buildQueueRow,
  findVerificationTasks,
  VerificationDecisionSchema,
} from "@/modules/human-resource-management/onboarding/verification/types/verification-queue.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// verifications — HR verification queue over the EMPLOYEE's documents tasks.
//
// GET — queue read: every employee owning `documents`-phase `onboarding_task`
// rows, aggregated into pending / returned / approved from the
// `documents_hr_verified` task (see verification-queue.schema.ts) and joined to
// the acknowledgement audit store by the `onboarding:employee:<id>` doc_ref.
// There is no `onboarding_profiles` read and no profile status gate.
// POST — one decision per call: approve | return(reason) | resubmit. The
// decision writes the `documents_hr_verified` task through the todo-19 task
// engine (the ONLY status writer) and re-reads before answering, so a 200 can
// never report a write that is not visible. Approve dispatches the frozen
// `onboarding.docs_verified` event keyed to the employee (never awaited).

const NAMESPACE = "onboarding:employee:";

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

function serverError() {
  return NextResponse.json(
    { success: false, message: "An unexpected error occurred. Please try again later." },
    { status: 500 }
  );
}

const EmployeeRowSchema = z.object({
  user_id: z.number().int().positive(),
  user_email: z.string().nullable().optional(),
});

interface VerificationEmployee {
  user_id: number;
  user_email: string | null;
}

/**
 * Reads the employee row (existence + notification email).
 * @returns The employee, or null when the row does not exist.
 * @throws Coded error when the lookup itself fails (never a false "missing").
 */
async function readEmployee(userId: number): Promise<VerificationEmployee | null> {
  const body: unknown = await dFetch(
    `/items/user?filter[user_id][_eq]=${userId}&fields=user_id,user_email&limit=1`
  );
  const parsed = z.object({ data: z.array(EmployeeRowSchema) }).safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `VERIFICATION_USER_READ_FAILED: user ${userId} lookup failed (${JSON.stringify(body).slice(0, 300)})`
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
 * @param filter - Directus query-string filter (already namespace-scoped).
 * @returns Ack-log rows, or [] when the read returns no data array.
 * @throws When dFetch itself fails (a swallowed read must not read as empty).
 */
async function readAckLogs(filter: string): Promise<AcknowledgementLog[]> {
  const body = (await dFetch(
    `/items/acknowledgement_logs?${filter}&fields=doc_ref,signer,acknowledged_at,method&limit=500`
  )) as { data?: AcknowledgementLog[] };
  return Array.isArray(body?.data) ? body.data : [];
}

function ackFilter(value: string): string {
  return `filter[doc_ref][_contains]=${encodeURIComponent(value)}`;
}

// The employee-scoped `onboarding.docs_verified` dispatch context: no
// applicant<->user link, so the bridge is synthetic and recipient resolution
// falls back to the `to_email` override; a miss records `skipped`, never a
// wrong-person send, still under the employee dedup key.
function buildDocsVerifiedCtx(
  userId: number,
  toEmail: string | null
): DispatchCtx {
  const ctx: DispatchCtx = {
    event_key: "onboarding.docs_verified",
    application_id: `onboarding-user:${userId}`,
    vars: {
      user_id: String(userId),
      employee_id: String(userId),
      status: "HR_VERIFIED",
    },
    idempotency_key: buildCompletionDedupKey(userId, "onboarding.docs_verified"),
  };
  if (toEmail) ctx.to_email = toEmail;
  return ctx;
}

export async function GET() {
  try {
    const [tasks, templates, logs] = await Promise.all([
      listOnboardingTasks({}),
      listOnboardingTaskTemplates(),
      readAckLogs(ackFilter(NAMESPACE)),
    ]);

    return NextResponse.json({
      success: true,
      data: aggregateQueue(tasks, templates, logs),
    });
  } catch (error) {
    console.error("[onboarding-verifications] queue error:", error);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    const validation = VerificationDecisionSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const { user_id: userId, decision, reason } = validation.data;
    const session = readOnboardingTaskSession(req);
    const actorId = session ? sessionActorId(session) : null;

    const [tasks, templates, employee] = await Promise.all([
      listOnboardingTasks({ userId }),
      listOnboardingTaskTemplates(),
      readEmployee(userId),
    ]);
    if (!employee) {
      return NextResponse.json(
        { success: false, message: "The employee does not exist" },
        { status: 400 }
      );
    }

    const pair = findVerificationTasks(tasks, templates);
    if (!pair.submitted || !pair.hr) {
      return NextResponse.json(
        {
          success: false,
          message: `Employee #${userId} has no onboarding documents tasks`,
        },
        { status: 400 }
      );
    }
    if (pair.hr.status === "done") {
      return NextResponse.json(
        {
          success: false,
          message: `Documents for employee #${userId} are already HR verified`,
        },
        { status: 400 }
      );
    }
    if (pair.submitted.status !== "done") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Documents are not submitted yet — only submitted documents can be verified",
        },
        { status: 400 }
      );
    }

    const wasReturned = pair.hr.status === "blocked";

    if (decision === "approve") {
      if (wasReturned) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Document was returned for resubmit — resubmit is required before approval",
          },
          { status: 400 }
        );
      }
      await completeOnboardingTask({ taskId: pair.hr.id, completedBy: actorId });
    } else if (decision === "return") {
      await updateOnboardingTask({
        taskId: pair.hr.id,
        patch: { status: "blocked", notes: (reason ?? "").trim() },
      });
    } else {
      if (!wasReturned) {
        return NextResponse.json(
          {
            success: false,
            message: "Documents were not returned — nothing to resubmit",
          },
          { status: 400 }
        );
      }
      await updateOnboardingTask({
        taskId: pair.hr.id,
        patch: { status: "pending", notes: null },
      });
    }

    // Re-read: a 200 must never report a write that is not visible.
    const [afterTasks, afterLogs] = await Promise.all([
      listOnboardingTasks({ userId }),
      readAckLogs(ackFilter(`${NAMESPACE}${userId}`)),
    ]);
    const row = buildQueueRow(userId, afterTasks, templates, afterLogs);
    const expected =
      decision === "approve"
        ? "approved"
        : decision === "return"
          ? "returned"
          : "pending";
    if (!row || row.queueState !== expected) {
      console.error("[onboarding-verifications] write not visible:", {
        userId,
        decision,
        row,
      });
      return serverError();
    }

    if (decision === "approve") {
      // Stage notify: committed above — never awaited, never throws. Dedup key
      // `<user_id>:onboarding.docs_verified`.
      void dispatchMail(
        "onboarding.docs_verified",
        buildDocsVerifiedCtx(userId, employee.user_email)
      ).catch(logRedacted);
    }

    const message =
      decision === "approve"
        ? "Documents approved"
        : decision === "return"
          ? "Returned for resubmit with reason"
          : "Resubmitted — back in the pending queue";
    return NextResponse.json({ success: true, data: row, message });
  } catch (error) {
    console.error("[onboarding-verifications] decision error:", error);
    return serverError();
  }
}
