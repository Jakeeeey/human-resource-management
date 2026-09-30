import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assemblePreEmploymentTrainingPrefill } from "@/modules/human-resource-management/onboarding/pre-employment-training/server/preEmploymentTrainingPrefill";
import {
  readOnboardingTaskSession,
  serverError,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskApiServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z
  .object({
    user_id: z.coerce.number().int().positive(),
    applicant_id: z.coerce.number().int().positive().optional(),
  })
  .strict();

export async function GET(req: NextRequest) {
  try {
    if (!readOnboardingTaskSession(req)) return unauthorized();
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = QuerySchema.safeParse(params);
    if (!query.success) {
      return validationFailed(query.error.flatten().fieldErrors);
    }
    const prefill = await assemblePreEmploymentTrainingPrefill({
      userId: query.data.user_id,
      ...(query.data.applicant_id !== undefined
        ? { applicantId: query.data.applicant_id }
        : {}),
    });
    return NextResponse.json({ success: true, data: prefill });
  } catch (error) {
    console.error("[pre-employment-training] prefill error:", error);
    return serverError();
  }
}
