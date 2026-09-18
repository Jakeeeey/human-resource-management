import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  readSigningSession,
  serverError,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/signing/server/signingApiServer";
import { readMissingHirePrerequisite } from "@/modules/human-resource-management/onboarding/signing/server/signingHireCommit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/signing-envelope/completion?applicant_id= — READ-ONLY
// hire-prerequisite preview (S5 re-QA finding N1).
//
// A completed signing set whose applicant is not yet `hired` needs to name the
// EXACT missing prerequisite (e.g. "application #90 has no email address") the
// moment a reviewer opens it cold — not only after pressing Retry. This route
// reuses the same read-only gate `fireHiredIfComplete` applies before any
// applicant write, so it can never disagree with the retry outcome, and it
// performs ZERO writes (no applicant flip, no orchestrator, no audit row).

const completionQuerySchema = z
  .object({
    applicant_id: z.coerce.number().int().positive(),
  })
  .strict();

export async function GET(req: NextRequest) {
  try {
    if (!readSigningSession(req)) return unauthorized();

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = completionQuerySchema.safeParse(params);
    if (!query.success) {
      return validationFailed(query.error.flatten().fieldErrors);
    }

    const blockedReason = await readMissingHirePrerequisite(
      query.data.applicant_id
    );
    return NextResponse.json({
      success: true,
      data: { blockedReason },
    });
  } catch (error) {
    console.error("[onboarding-signing-completion] precheck error:", error);
    return serverError();
  }
}
