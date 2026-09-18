import { NextRequest, NextResponse } from "next/server";

import { listHireRoster } from "@/modules/human-resource-management/onboarding/hub/server/hire-roster-service";
import {
  readOnboardingTaskSession,
  serverError,
  unauthorized,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskApiServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/hire-roster
//   The onboarding hub entry roster: one enriched row per employee that owns
//   `onboarding_task` rows (hire, status/phase, next action, owner, due,
//   blockers). Read-only and session-gated — the Directus token never reaches
//   the browser.
export async function GET(req: NextRequest) {
  try {
    if (!readOnboardingTaskSession(req)) return unauthorized();

    const hires = await listHireRoster();
    return NextResponse.json({ success: true, data: { hires } });
  } catch (error) {
    console.error("[hire-roster] list error:", error);
    return serverError();
  }
}
