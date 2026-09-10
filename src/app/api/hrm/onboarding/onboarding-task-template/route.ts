import { NextRequest, NextResponse } from "next/server";

import { listOnboardingTaskTemplates } from "@/modules/human-resource-management/onboarding/tasks/server/task-template-service";
import {
  readOnboardingTaskSession,
  serverError,
  unauthorized,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskApiServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/onboarding-task-template — the seeded post-hire
// catalog (documents / orientation / training / equipment), phase/sort order.
// Read-only; the seed route owns writes.

export async function GET(req: NextRequest) {
  try {
    if (!readOnboardingTaskSession(req)) return unauthorized();

    const rows = await listOnboardingTaskTemplates();
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("[onboarding-task-template] list error:", error);
    return serverError();
  }
}
