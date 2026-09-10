import { NextRequest, NextResponse } from "next/server";

import { ensureOnboardingTaskTemplates } from "@/modules/human-resource-management/onboarding/tasks/server/task-template-service";
import {
  readOnboardingTaskSession,
  serverError,
  sessionActorId,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskApiServer";
import { SeedOnboardingTaskTemplatesSchema } from "@/modules/human-resource-management/onboarding/tasks/types/onboarding-task-api.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/hrm/onboarding/onboarding-task-template/seed — upserts the
// code-owned catalog by `code` (idempotent: a fully seeded catalog reports
// zero creates/updates and performs zero writes). Body is a strict empty
// object.

export async function POST(req: NextRequest) {
  try {
    const session = readOnboardingTaskSession(req);
    if (!session) return unauthorized();

    const body: unknown = await req.json().catch(() => null);
    const validation = SeedOnboardingTaskTemplatesSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const result = await ensureOnboardingTaskTemplates({
      actorId: sessionActorId(session),
    });
    return NextResponse.json({ success: true, data: result.summary });
  } catch (error) {
    console.error("[onboarding-task-template] seed error:", error);
    return serverError();
  }
}
