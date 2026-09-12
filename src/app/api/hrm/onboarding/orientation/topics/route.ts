import { NextRequest, NextResponse } from "next/server";

import {
  CreateOrientationTopicSchema,
  type OrientationTopic,
} from "@/modules/human-resource-management/onboarding/orientation/types/orientation.schema";
import {
  listTopics,
  upsertTopic,
} from "@/modules/human-resource-management/onboarding/orientation/orientationStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/orientation/topics — topic lists (seed + admin
// overlays), company track first. The hub tab renders from here, never
// from inline literals.
// POST — add/edit a topic. No role gate in app code: access is governed by
// the platform's external module authorization (plan §12).

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

function normalizeTopic(row: OrientationTopic): OrientationTopic {
  return {
    ...row,
    required: row.required === true,
  };
}

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: (await listTopics()).map(normalizeTopic),
    });
  } catch (error) {
    console.error("[onboarding-orientation] topics list error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    const validation = CreateOrientationTopicSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const created = await upsertTopic({
      id: validation.data.id,
      track: validation.data.track,
      title: validation.data.title,
      required: validation.data.required,
    });

    return NextResponse.json(
      { success: true, data: normalizeTopic(created) },
      { status: 201 }
    );
  } catch (error) {
    console.error("[onboarding-orientation] topics create error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
