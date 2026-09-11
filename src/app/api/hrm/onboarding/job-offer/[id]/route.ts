import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  isAbsentItemError,
  notFound,
  readSigningSession,
  serverError,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/signing/server/signingApiServer";
import {
  SIGNING_OFFER_ERROR_CODES,
  signJobOffer,
} from "@/modules/human-resource-management/onboarding/signing/server/signing-offer-service";
import { JobOfferSchema } from "@/modules/human-resource-management/onboarding/signing/types/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/job-offer/[id] — read one offer (404 when absent,
// 400 on a non-numeric id). Server-side only: the Directus token never
// reaches the browser.
//
// PATCH /api/hrm/onboarding/job-offer/[id] — accept one offer (todo 11):
// `signature_file` is OPTIONAL (the digital-signature hook is future work);
// `strokes` (serialized ink) and `signed_pdf_file` (burned output UUID) ride
// along. The route writes NOTHING itself — it delegates to `signJobOffer`,
// which marks the offer signed, calls the todo-12 rollup service, and advances
// the applicant to `incomplete` while the signing set is not complete.

export async function GET(
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

    const result = (await dFetch(`/items/job_offer/${offerId}`)) as {
      data?: unknown;
      errors?: unknown;
    };
    if (result?.errors || !result?.data) {
      if (isAbsentItemError(result)) {
        return notFound("Job offer not found");
      }
      console.error(
        "[onboarding-job-offer] fetch failed:",
        JSON.stringify(result)
      );
      return serverError();
    }

    const parsed = JobOfferSchema.safeParse(result.data);
    if (!parsed.success) {
      console.error(
        "[onboarding-job-offer] row contract mismatch:",
        JSON.stringify(parsed.error.flatten())
      );
      return serverError();
    }
    return NextResponse.json({ success: true, data: parsed.data });
  } catch (error) {
    console.error("[onboarding-job-offer] fetch error:", error);
    return serverError();
  }
}

const JobOfferSignSchema = z
  .object({
    signature_file: z.string().min(1).nullable().default(null),
    strokes: z.string().min(1).nullable().default(null),
    signed_pdf_file: z.string().min(1).nullable().default(null),
  })
  .strict();

export async function PATCH(
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
    const validation = JobOfferSignSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    try {
      const result = await signJobOffer({
        offerId,
        signatureFile: validation.data.signature_file,
        strokes: validation.data.strokes,
        signedPdfFile: validation.data.signed_pdf_file,
      });
      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes(SIGNING_OFFER_ERROR_CODES.offerNotFound)) {
        return notFound("Job offer not found");
      }
      if (message.includes(SIGNING_OFFER_ERROR_CODES.offerAlreadySigned)) {
        return NextResponse.json(
          {
            success: false,
            message:
              "This job offer is already signed; its signature cannot be overwritten.",
          },
          { status: 409 }
        );
      }
      if (message.includes(SIGNING_OFFER_ERROR_CODES.offerClosed)) {
        return NextResponse.json(
          {
            success: false,
            message: "This job offer is declined and can no longer be signed.",
          },
          { status: 409 }
        );
      }
      if (message.includes(SIGNING_OFFER_ERROR_CODES.envelopeNotFound)) {
        return notFound("Signing envelope not found for this offer");
      }
      throw error;
    }
  } catch (error) {
    console.error("[onboarding-job-offer] sign error:", error);
    return serverError();
  }
}
