import { NextRequest, NextResponse } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  TransitionTrainingAssignmentSchema,
} from "@/modules/human-resource-management/onboarding/training/types/training-taking.schema";
import {
  assertAssignmentOwner,
  normalizeTrainingAssignment,
  getPhilippineTime,
} from "@/modules/human-resource-management/onboarding/training/trainingTaking";
import {
  transitionAssignment,
  type TrainingAssignment,
} from "@/modules/human-resource-management/onboarding/training/trainingAssignmentAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/training-assignments/[id] — read one assignment.
// PATCH — guarded single-step transition (assigned -> in_progress ->
// completed) via the Todo 4 adapter guard (`transitionAssignment`).
// Completing requires `completed_ref`; the completed state is terminal.
// IDOR: an actor may transition ONLY their own assignment (owner
// mismatch -> 403). No role branch — HR override is external (plan §12).

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

async function loadAssignment(id: number) {
  const found = (await dFetch(`/items/training_assignments/${id}`)) as {
    data?: Record<string, unknown>;
  };
  return found?.data ?? null;
}

export async function GET(
  _req: NextRequest,
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
    const row = await loadAssignment(assignmentId);
    if (!row) {
      return NextResponse.json(
        { success: false, message: "Assignment not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      data: normalizeTrainingAssignment(row),
    });
  } catch (error) {
    console.error("[onboarding-training-assignments] get error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const body: unknown = await req.json().catch(() => null);
    const validation = TransitionTrainingAssignmentSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const row = await loadAssignment(assignmentId);
    if (!row) {
      return NextResponse.json(
        { success: false, message: "Assignment not found" },
        { status: 404 }
      );
    }
    const current = normalizeTrainingAssignment(row);

    const ownership = assertAssignmentOwner(current, validation.data.actor);
    if (!ownership.ok) {
      return NextResponse.json(
        { success: false, message: ownership.error },
        { status: ownership.status }
      );
    }

    const next = transitionAssignment(current as TrainingAssignment, validation.data.to, {
      completedRef: validation.data.completed_ref ?? null,
    });
    if (!next.ok) {
      return NextResponse.json(
        { success: false, message: next.error },
        { status: 409 }
      );
    }

    const now = getPhilippineTime();
    const updated = (await dFetch(`/items/training_assignments/${assignmentId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: next.assignment.status,
        completed_ref: next.assignment.completed_ref,
        updated_at: now,
      }),
    })) as { data?: Record<string, unknown> };

    return NextResponse.json({
      success: true,
      data: updated?.data ? normalizeTrainingAssignment(updated.data) : next.assignment,
      message:
        validation.data.reason && validation.data.to === "in_progress"
          ? `Attempt stays in progress: ${validation.data.reason}`
          : undefined,
    });
  } catch (error) {
    console.error("[onboarding-training-assignments] transition error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
