import { NextRequest, NextResponse } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { dispatchMail } from "@/modules/human-resource-management/recruitment/mailing/utils/dispatchMail";
import { logRedacted } from "@/modules/human-resource-management/recruitment/mailing/utils/mailLog";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";
// Grade + persist entries reused from the untouched quiz engine: the SAME
// `gradeAnswers` / `persistGradedAttempt` the `quiz-attempt` POST route
// calls — fed ONLY through the Todo 4 adapter builders (`buildGradeInput`,
// `buildCompletionScalars`, `transitionAssignment`). Zero grading math here.
import {
  gradeAnswers,
  persistGradedAttempt,
} from "@/modules/human-resource-management/quiz-file-management/utils/grading";
import {
  SubmitTrainingAttemptSchema,
} from "@/modules/human-resource-management/onboarding/training/types/training-taking.schema";
import {
  assertAssignmentOwner,
  normalizeTrainingAssignment,
  resolveEngineApplicant,
  getPhilippineTime,
} from "@/modules/human-resource-management/onboarding/training/trainingTaking";
import {
  abandonedInProgress,
  buildCompletionScalars,
  buildGradeInput,
  describeRetakeTarget,
  transitionAssignment,
  type TrainingAssignment,
} from "@/modules/human-resource-management/onboarding/training/trainingAssignmentAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/hrm/onboarding/training-assignments/[id]/submit — hiree-owned
// grade entry. Gates: session cookie (401), assignment exists (404),
// owner (IDOR -> 403), still `in_progress` (else 409).
//
// - Abandon (`{ abandon: true, reason }`): the assignment STAYS
//   `in_progress` WITH the reason (adapter `abandonedInProgress`) — never
//   auto-completed/failed. Re-take opens a NEW engine attempt under the
//   SAME assignment id (adapter `describeRetakeTarget`).
// - Submit (`answers`): graded by the REAL `gradeAnswers` via the adapter's
//   `buildGradeInput`. The engine attempt row is persisted with the hire's
//   REAL applicant id resolved server-side through the application chain
//   (`assignment.application_id -> application.applicant_id`); when the
//   chain yields null the submit is refused with reason (422, stays
//   `in_progress`) — applicant ids are never accepted from the client and
//   never fabricated. The assignment then moves to `completed` with
//   `completed_ref` pointing at the engine attempt row, and the route
//   returns ONLY display-safe scalars (same done-screen rule as the quiz
//   taking module: no answers, no keys).

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const assignmentId = Number(id);
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid assignment id" },
        { status: 400 }
      );
    }

    const token = req.cookies.get(COOKIE_NAME)?.value;
    const session = token ? decodeJwtPayload(token) : null;
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }
    const administeredBy = session.sub ? Number(session.sub) || null : null;

    const body: unknown = await req.json().catch(() => null);
    const validation = SubmitTrainingAttemptSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const found = (await dFetch(`/items/training_assignments/${assignmentId}`)) as {
      data?: Record<string, unknown>;
    };
    const row = found?.data ?? null;
    if (!row) {
      return NextResponse.json(
        { success: false, message: "Assignment not found" },
        { status: 404 }
      );
    }
    const assignment = normalizeTrainingAssignment(row);

    const ownership = assertAssignmentOwner(assignment, validation.data.actor);
    if (!ownership.ok) {
      return NextResponse.json(
        { success: false, message: ownership.error },
        { status: ownership.status }
      );
    }

    if (assignment.status !== "in_progress") {
      return NextResponse.json(
        {
          success: false,
          message:
            assignment.status === "completed"
              ? "This training is already completed"
              : "Start this training before submitting",
        },
        { status: 409 }
      );
    }

    // Abandon path: stays in_progress WITH reason; re-take allowed under
    // the same assignment id.
    if (validation.data.abandon === true) {
      const reason = validation.data.reason ?? "Attempt ended before submitting";
      const held = abandonedInProgress(reason);
      describeRetakeTarget(assignment);
      return NextResponse.json({
        success: true,
        data: { assignment, abandoned: held.status === "in_progress", reason: held.reason },
        message: `Attempt stays in progress: ${held.reason}`,
      });
    }

    const gradeInput = buildGradeInput(
      assignment,
      (validation.data.answers ?? []).map((a) => ({ ...a }))
    );
    if (!gradeInput.ok) {
      return NextResponse.json(
        { success: false, message: gradeInput.error },
        { status: 400 }
      );
    }

    const outcome = await gradeAnswers(gradeInput.quizId, gradeInput.answers);
    if (!outcome.ok) {
      return NextResponse.json(
        { success: false, message: outcome.error },
        { status: outcome.status }
      );
    }

    // Engine-applicant bridge: REAL applicant id through the application
    // chain only. Null -> refuse with reason, stays in_progress.
    let applicantId: number | null = null;
    if (assignment.application_id !== null) {
      try {
        const application = (await dFetch(
          `/items/application/${assignment.application_id}?fields=id,applicant_id`
        )) as { data?: Record<string, unknown> };
        applicantId = resolveEngineApplicant(application?.data ?? null);
      } catch {
        applicantId = null;
      }
    }
    if (applicantId === null) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Completion needs an application link for grade filing — HR links it in the hub, then re-submit. The attempt stays in progress.",
        },
        { status: 422 }
      );
    }

    const attempt = await persistGradedAttempt({
      quizId: gradeInput.quizId,
      applicantId,
      administeredBy,
      startedAt: validation.data.started_at ?? null,
      grade: outcome,
      applicationId: assignment.application_id,
    });
    const attemptId = Number(attempt?.id);
    if (!Number.isInteger(attemptId) || attemptId <= 0) {
      console.error("[onboarding-training-assignments] persist returned no attempt id");
      return NextResponse.json(
        { success: false, message: "Grade filing failed. The attempt stays in progress." },
        { status: 502 }
      );
    }

    const next = transitionAssignment(assignment as TrainingAssignment, "completed", {
      completedRef: attemptId,
    });
    if (!next.ok) {
      return NextResponse.json({ success: false, message: next.error }, { status: 409 });
    }

    const now = getPhilippineTime();
    const updated = (await dFetch(`/items/training_assignments/${assignmentId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "completed",
        completed_ref: attemptId,
        updated_at: now,
      }),
    })) as { data?: Record<string, unknown> };
    const completed = updated?.data
      ? normalizeTrainingAssignment(updated.data)
      : { ...assignment, status: "completed" as const, completed_ref: attemptId };

    const completion = buildCompletionScalars(outcome);
    // Stage notify: the training-completed transition is committed above —
    // never awaited, never throws. Employee-keyed dedup key
    // `<user_id>:onboarding.training_completed` (no profile scope).
    void dispatchMail("onboarding.training_completed", {
      event_key: "onboarding.training_completed",
      application_id:
        completed.application_id !== null && completed.application_id > 0
          ? completed.application_id
          : `onboarding-user:${completed.user_id}`,
      vars: {
        user_id: String(completed.user_id),
        employee_id: String(completed.user_id),
        status: "completed",
      },
      idempotency_key: `${completed.user_id}:onboarding.training_completed`,
    }).catch(logRedacted);
    return NextResponse.json({
      success: true,
      data: {
        assignment: completed,
        attempt_id: attemptId,
        score: completion.score,
        percentage_score: completion.percentage_score,
        passed: completion.passed,
        completion,
      },
    });
  } catch (error) {
    console.error("[onboarding-training-assignments] submit error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
