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
  SIGNING_ROLLUP_ERROR_CODES,
  signPaperworkItem,
} from "@/modules/human-resource-management/onboarding/signing/server/signing-rollup-service";
import { PaperworkItemSchema } from "@/modules/human-resource-management/onboarding/signing/types/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/paperwork-item/[id] — read one per-template item
// (404 when absent, 400 on a non-numeric id). Server-side only: the
// Directus token never reaches the browser.
//
// PATCH /api/hrm/onboarding/paperwork-item/[id] — sign one item (todo 12):
// persists `status`/`strokes`/`pdf_file` and recomputes BOTH derived rollups
// via the single signing-rollup service (this route never writes
// paperworks.status / signing_envelope.status itself).

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!readSigningSession(req)) return unauthorized();

    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid paperwork item id" },
        { status: 400 }
      );
    }

    const result = (await dFetch(`/items/paperwork_item/${itemId}`)) as {
      data?: unknown;
      errors?: unknown;
    };
    if (result?.errors || !result?.data) {
      if (isAbsentItemError(result)) {
        return notFound("Paperwork item not found");
      }
      console.error(
        "[onboarding-paperwork-item] fetch failed:",
        JSON.stringify(result)
      );
      return serverError();
    }

    const parsed = PaperworkItemSchema.safeParse(result.data);
    if (!parsed.success) {
      console.error(
        "[onboarding-paperwork-item] row contract mismatch:",
        JSON.stringify(parsed.error.flatten())
      );
      return serverError();
    }
    return NextResponse.json({ success: true, data: parsed.data });
  } catch (error) {
    console.error("[onboarding-paperwork-item] fetch error:", error);
    return serverError();
  }
}

const PaperworkItemSignSchema = z
  .object({
    strokes: z.string().min(1),
    pdf_file: z.string().min(1),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!readSigningSession(req)) return unauthorized();

    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid paperwork item id" },
        { status: 400 }
      );
    }

    const body: unknown = await req.json().catch(() => null);
    const validation = PaperworkItemSignSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    try {
      const result = await signPaperworkItem({
        itemId,
        strokes: validation.data.strokes,
        pdfFile: validation.data.pdf_file,
      });
      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes(SIGNING_ROLLUP_ERROR_CODES.itemNotFound)) {
        return notFound("Paperwork item not found");
      }
      if (message.includes(SIGNING_ROLLUP_ERROR_CODES.itemAlreadySigned)) {
        return NextResponse.json(
          {
            success: false,
            message:
              "This paperwork item is already signed; a signature cannot be overwritten.",
          },
          { status: 409 }
        );
      }
      if (message.includes(SIGNING_ROLLUP_ERROR_CODES.envelopeNotFound)) {
        return notFound("Signing envelope not found for this item");
      }
      if (
        message.includes(SIGNING_ROLLUP_ERROR_CODES.envelopeStructureInvalid)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "The signing envelope is missing its paperworks/offer link.",
          },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("[onboarding-paperwork-item] sign error:", error);
    return serverError();
  }
}
