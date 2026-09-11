import { NextRequest, NextResponse } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  getPhilippineTime,
  isAbsentItemError,
  mapWriteFailure,
  notFound,
  readSigningSession,
  serverError,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/signing/server/signingApiServer";
import { JobOfferUpdateSchema } from "@/modules/human-resource-management/onboarding/signing/types/signing-api.schema";
import { JobOfferSchema } from "@/modules/human-resource-management/onboarding/signing/types/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/hrm/onboarding/job-offer/[id]/offer — attach or clear offer
// metadata (`pdf_file` UUID from the offer upload route, `terms_snapshot`,
// `signing_envelope_id`, `status`) without touching the signing contract:
// the sign PATCH on `job-offer/[id]` keeps its `{ signature_file }` shape.

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
    const validation = JobOfferUpdateSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const now = getPhilippineTime();
    const updated = (await dFetch(`/items/job_offer/${offerId}`, {
      method: "PATCH",
      body: JSON.stringify({ ...validation.data, updated_at: now }),
    })) as { data?: unknown; errors?: unknown };

    if (updated?.errors || !updated?.data) {
      if (isAbsentItemError(updated)) {
        return notFound("Job offer not found");
      }
      console.error(
        "[onboarding-job-offer] offer update failed:",
        JSON.stringify(updated)
      );
      const failure = mapWriteFailure(updated);
      return NextResponse.json(
        { success: false, message: failure.message },
        { status: failure.status }
      );
    }

    const parsed = JobOfferSchema.safeParse(updated.data);
    if (!parsed.success) {
      console.error(
        "[onboarding-job-offer] updated row contract mismatch:",
        JSON.stringify(parsed.error.flatten())
      );
      return serverError();
    }
    return NextResponse.json({ success: true, data: parsed.data });
  } catch (error) {
    console.error("[onboarding-job-offer] offer update error:", error);
    return serverError();
  }
}
