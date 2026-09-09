import { NextRequest, NextResponse } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";
// Draw entry reused from the untouched quiz engine: this is the SAME
// `drawQuizQuestions` function the existing auth-gated
// `quiz-attempt/start` route calls — called through the Todo 4 adapter's
// `buildDrawInput`, never re-implemented.
import { drawQuizQuestions } from "@/modules/human-resource-management/quiz-file-management/utils/quiz-draw";
import {
  StartTrainingAttemptSchema,
} from "@/modules/human-resource-management/onboarding/training/types/training-taking.schema";
import {
  assertAssignmentOwner,
  normalizeTrainingAssignment,
  getPhilippineTime,
} from "@/modules/human-resource-management/onboarding/training/trainingTaking";
import { buildDrawInput } from "@/modules/human-resource-management/onboarding/training/trainingAssignmentAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/hrm/onboarding/training-assignments/[id]/start — hiree-owned
// draw entry. Gates (in order): session cookie (same auth gate as the
// existing `quiz-attempt/start` route -> 401), assignment exists (404),
// hiree session owns the assignment (IDOR: mismatch -> 403), assignment
// still takable (completed -> 409). Then draws via the untouched engine
// and moves `assigned -> in_progress` (an already-`in_progress` assignment
// is resumable: fresh draw, `resumed: true`, state row re-asserted).
// The draw body carries NO answer keys (engine draw shape).

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

    const body: unknown = await req.json().catch(() => null);
    const validation = StartTrainingAttemptSchema.safeParse(body);
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

    if (assignment.status === "completed") {
      return NextResponse.json(
        { success: false, message: "This training is already completed" },
        { status: 409 }
      );
    }

    const drawn = await drawQuizQuestions(buildDrawInput(assignment));
    if (!drawn.ok) {
      return NextResponse.json(
        { success: false, message: drawn.error },
        { status: drawn.status }
      );
    }

    const resumed = assignment.status === "in_progress";
    let current = assignment;
    if (!resumed) {
      const now = getPhilippineTime();
      const updated = (await dFetch(`/items/training_assignments/${assignmentId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "in_progress", updated_at: now }),
      })) as { data?: Record<string, unknown> };
      current = updated?.data ? normalizeTrainingAssignment(updated.data) : assignment;
    }

    return NextResponse.json({
      success: true,
      data: {
        assignment: current,
        quiz: drawn.body.quiz,
        questions: drawn.body.questions,
        resumed,
      },
    });
  } catch (error) {
    console.error("[onboarding-training-assignments] start error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
