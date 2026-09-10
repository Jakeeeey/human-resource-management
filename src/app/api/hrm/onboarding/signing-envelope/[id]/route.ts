import { NextRequest, NextResponse } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  isAbsentItemError,
  notFound,
  readSigningSession,
  serverError,
  unauthorized,
} from "@/modules/human-resource-management/onboarding/signing/server/signingApiServer";
import { SigningEnvelopeSchema } from "@/modules/human-resource-management/onboarding/signing/types/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/signing-envelope/[id] — read one envelope (404
// when absent, 400 on a non-numeric id). Server-side only: the Directus
// token never reaches the browser.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!readSigningSession(req)) return unauthorized();

    const { id } = await params;
    const envelopeId = Number(id);
    if (!Number.isInteger(envelopeId) || envelopeId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid signing envelope id" },
        { status: 400 }
      );
    }

    const result = (await dFetch(`/items/signing_envelope/${envelopeId}`)) as {
      data?: unknown;
      errors?: unknown;
    };
    if (result?.errors || !result?.data) {
      if (isAbsentItemError(result)) {
        return notFound("Signing envelope not found");
      }
      console.error(
        "[onboarding-signing-envelope] fetch failed:",
        JSON.stringify(result)
      );
      return serverError();
    }

    const parsed = SigningEnvelopeSchema.safeParse(result.data);
    if (!parsed.success) {
      console.error(
        "[onboarding-signing-envelope] row contract mismatch:",
        JSON.stringify(parsed.error.flatten())
      );
      return serverError();
    }
    return NextResponse.json({ success: true, data: parsed.data });
  } catch (error) {
    console.error("[onboarding-signing-envelope] fetch error:", error);
    return serverError();
  }
}
