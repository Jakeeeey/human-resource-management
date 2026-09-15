import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { APPLICANT_STATUS_ERROR_CODES } from "@/modules/human-resource-management/shared/services/applicant-status-service";
import {
  notFound,
  readSigningSession,
  serverError,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/signing/server/signingApiServer";
import {
  CloseOutOutcomeSchema,
  SIGNING_CLOSEOUT_ERROR_CODES,
  closeOutNonSigner,
} from "@/modules/human-resource-management/onboarding/signing/server/signing-closeout-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/hrm/onboarding/job-offer/[id]/close — terminal close-out for a
// NON-SIGNING applicant (todo 18): applicant-decline -> withdrawn, HR
// reject/withdraw -> rejected, offer expiry -> rejected; ALL THREE mark
// `job_offer.status="declined"` (`expired` is not a stored value). The route
// writes NOTHING itself — it delegates to `closeOutNonSigner`; the applicant
// write goes through the single status writer, and a `hired` applicant is
// refused (409) before any write. The signing set is never deleted.

const CloseOutBodySchema = z
  .object({
    outcome: CloseOutOutcomeSchema,
  })
  .strict();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!readSigningSession(req)) return unauthorized();

    const { id } = await params;
    const offerId = Number(id);
    if (!Number.isInteger(offerId) || offerId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid job offer id" },
        { status: 400 }
      );
    }

    const body: unknown = await req.json().catch(() => null);
    const validation = CloseOutBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    try {
      const result = await closeOutNonSigner({
        offerId,
        outcome: validation.data.outcome,
      });
      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes(SIGNING_CLOSEOUT_ERROR_CODES.offerNotFound)) {
        return notFound("Job offer not found");
      }
      if (message.includes(SIGNING_CLOSEOUT_ERROR_CODES.applicantHired)) {
        return NextResponse.json(
          {
            success: false,
            message:
              "This applicant is hired; a completed hire cannot be closed out.",
          },
          { status: 409 }
        );
      }
      if (message.includes(APPLICANT_STATUS_ERROR_CODES.transitionNotAllowed)) {
        return NextResponse.json(
          {
            success: false,
            message: "This applicant is already closed with a different outcome.",
          },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("[onboarding-job-offer] close-out error:", error);
    return serverError();
  }
}
