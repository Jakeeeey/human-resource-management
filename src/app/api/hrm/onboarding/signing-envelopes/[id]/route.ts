import { NextRequest, NextResponse } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { parseInk } from "@/modules/human-resource-management/onboarding/signing/signingStrokes";
import {
  SaveSigningDraftSchema,
  type SigningEnvelopeContent,
} from "@/modules/human-resource-management/onboarding/signing/types/signing-envelope.schema";
import { normalizeSigningEnvelope } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/signing-envelopes/[id] — single envelope (404
// when absent). The Todo 7 surface hydrates drafts here (resumable).
// PATCH /api/hrm/onboarding/signing-envelopes/[id] — Save-draft ONLY:
// persists the strokes document, keeps status=draft. Rejected on a locked
// (finished) envelope (409). Finish is the separate POST /[id]/finish
// write — never a PATCH flag — so draft vs finish stay distinct writes.

function getPhilippineTime(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

function invalidId() {
  return NextResponse.json(
    { success: false, message: "Invalid envelope id" },
    { status: 400 }
  );
}

async function loadEnvelope(id: number) {
  const result = (await dFetch(`/items/signing_envelopes/${id}`)) as {
    data?: Record<string, unknown>;
  };
  return result?.data ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const envelopeId = Number(id);
    if (!Number.isInteger(envelopeId) || envelopeId <= 0) return invalidId();

    const row = await loadEnvelope(envelopeId);
    if (!row) {
      return NextResponse.json(
        { success: false, message: "Envelope not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: normalizeSigningEnvelope(row) });
  } catch (error) {
    console.error("[onboarding-signing-envelopes] fetch error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const envelopeId = Number(id);
    if (!Number.isInteger(envelopeId) || envelopeId <= 0) return invalidId();

    const body: unknown = await req.json().catch(() => null);
    const validation = SaveSigningDraftSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const current = await loadEnvelope(envelopeId);
    if (!current) {
      return NextResponse.json(
        { success: false, message: "Envelope not found" },
        { status: 404 }
      );
    }
    if (current["status"] === "finished") {
      return NextResponse.json(
        { success: false, message: "Envelope is locked and cannot accept drafts" },
        { status: 409 }
      );
    }

    // Structural check: the draft document must carry a parseable ink model
    // (malformed payloads map to 400 with reason — never a corrupt envelope).
    try {
      const content = JSON.parse(validation.data.strokes) as SigningEnvelopeContent;
      const ink = content?.ink ?? null;
      parseInk(JSON.stringify(ink));
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid stroke payload: ink model is malformed" },
        { status: 400 }
      );
    }

    const updated = (await dFetch(`/items/signing_envelopes/${envelopeId}`, {
      method: "PATCH",
      body: JSON.stringify({
        strokes: validation.data.strokes,
        updated_at: getPhilippineTime(),
      }),
    })) as { data?: Record<string, unknown> };

    return NextResponse.json({
      success: true,
      data: updated?.data ? normalizeSigningEnvelope(updated.data) : null,
    });
  } catch (error) {
    console.error("[onboarding-signing-envelopes] draft error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
