import { NextRequest, NextResponse } from "next/server";

import { provisionHireUserAtSigning } from "@/modules/human-resource-management/onboarding/hire/server/provisionHireUserAtSigning";
import { HireGateProvisionBodySchema } from "@/modules/human-resource-management/onboarding/hire/types/hire-gate.schema";
import {
  readOnboardingTaskSession,
  serverError,
  sessionActorId,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskApiServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = readOnboardingTaskSession(req);
    if (!session) return unauthorized();

    const body: unknown = await req.json().catch(() => null);
    const validation = HireGateProvisionBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const userId = await provisionHireUserAtSigning({
      applicantId: validation.data.applicant_id,
      actorId: sessionActorId(session),
    });
    if (userId === null) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The hiree account could not be created yet. Retry shortly — signing-time provisioning heals on the next signing recompute.",
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true, data: { userId } });
  } catch (error) {
    console.error("[hire-gate] provision error:", error);
    return serverError();
  }
}
