import { NextRequest, NextResponse } from "next/server";

import { UpdateOrientationTopicSchema } from "@/modules/human-resource-management/onboarding/orientation/types/orientation.schema";
import { patchTopic } from "@/modules/human-resource-management/onboarding/orientation/orientationStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/hrm/onboarding/orientation/topics/[id] — edit of one topic
// (title / required). No role gate in app code: access is governed by the
// platform's external module authorization (plan §12). Unknown id → 404.

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

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
    const validation = UpdateOrientationTopicSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const updated = await patchTopic(id, {
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
