import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  isOrientationDone,
  listChecksFor,
  listTopics,
} from "@/modules/human-resource-management/onboarding/orientation/orientationStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/orientation?profile_id= — per-hire orientation
// state: topics (seed + admin overlays) + checks + the both-tracks-done
// predicate. Feeds the hub Orientation tab and the Todo 5 machine /
// Todo 14 orchestrator evidence (`StageEvidence.orientationDone`).

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

const stateQuerySchema = z
  .object({
    profile_id: z.coerce.number().int().positive(),
  })
  .strict();

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = stateQuerySchema.safeParse(params);
    if (!query.success) {
      return validationFailed(query.error.flatten().fieldErrors);
    }

    const profileId = query.data.profile_id;
    return NextResponse.json({
      success: true,
      data: {
        topics: listTopics(),
        checks: listChecksFor(profileId),
        done: isOrientationDone(profileId),
      },
    });
  } catch (error) {
    console.error("[onboarding-orientation] state error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
