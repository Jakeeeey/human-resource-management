import { NextRequest, NextResponse } from "next/server";

import { CheckOffOrientationSchema } from "@/modules/human-resource-management/onboarding/orientation/types/orientation.schema";
import {
  checkOffTopic,
  isOrientationDone,
} from "@/modules/human-resource-management/onboarding/orientation/orientationStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/hrm/onboarding/orientation/check — check off one topic for one
// hire. Role-gated by the responsible party (company → hr, department →
// department): a wrong-role attempt is 403 and moves NOTHING (predicate
// unmoved). Unknown topic → 404. Idempotent re-check returns the row.

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    const validation = CheckOffOrientationSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const result = checkOffTopic({
      profileId: validation.data.profile_id,
      topicId: validation.data.topic_id,
      role: validation.data.actor.role,
    });

    if (!result.ok) {
      if (result.forbidden) {
        return NextResponse.json(
          { success: false, message: result.reason },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { success: false, message: result.reason },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        check: result.check,
        done: isOrientationDone(validation.data.profile_id),
      },
    });
  } catch (error) {
    console.error("[onboarding-orientation] check error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
