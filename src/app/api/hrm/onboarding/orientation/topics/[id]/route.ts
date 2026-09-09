import { NextRequest, NextResponse } from "next/server";

import {
  OrientationActorSchema,
  UpdateOrientationTopicSchema,
} from "@/modules/human-resource-management/onboarding/orientation/types/orientation.schema";
import { patchTopic } from "@/modules/human-resource-management/onboarding/orientation/orientationStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/hrm/onboarding/orientation/topics/[id] — admin edit of one
// topic (title / required). Admin surface is HR-owned: actor must be `hr`
// (anything else → 403). Unknown id → 404.

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

const patchBodySchema = UpdateOrientationTopicSchema.extend({
  actor: OrientationActorSchema,
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Invalid topic id" },
        { status: 400 }
      );
    }

    const body: unknown = await req.json().catch(() => null);
    const validation = patchBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }
    if (validation.data.actor.role !== "hr") {
      return NextResponse.json(
        { success: false, message: "Only HR can edit orientation topics" },
        { status: 403 }
      );
    }

    const updated = patchTopic(id, {
      title: validation.data.title,
      required: validation.data.required,
    });
    if (!updated) {
      return NextResponse.json(
        { success: false, message: "Orientation topic not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { ...updated, required: updated.required === true },
    });
  } catch (error) {
    console.error("[onboarding-orientation] topic patch error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
