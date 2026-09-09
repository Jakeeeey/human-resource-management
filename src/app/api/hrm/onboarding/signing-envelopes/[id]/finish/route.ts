import { NextRequest, NextResponse } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  isPaperworkValid,
} from "@/modules/human-resource-management/onboarding/paperwork/paperworkValidity";
import type { PaperworkZone } from "@/modules/human-resource-management/onboarding/paperwork/types/paperwork-template.schema";
import { parseInk } from "@/modules/human-resource-management/onboarding/signing/signingStrokes";
import { mergeStampsIntoInk } from "@/modules/human-resource-management/onboarding/signing/signingStamps";
import {
  FinishSigningEnvelopeSchema,
  type SigningEnvelopeContent,
} from "@/modules/human-resource-management/onboarding/signing/types/signing-envelope.schema";
import { normalizeSigningEnvelope } from "../../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/hrm/onboarding/signing-envelopes/[id]/finish — Finish (lock)
// write, DISTINCT from Save-draft. Gates SOLELY on the Todo 6 validity
// predicate (`isPaperworkValid`, imported — never redefined): an invalid
// envelope is blocked with the predicate's reason (422), never locked.
// Callable by the hiree session owning the envelope (actor.profile_id must
// equal the envelope's profile_id) plus HR override (actor.role=hr); both
// paths are logged into the persisted strokes document (`finishedBy`).
// Success locks the envelope (status=finished, finished_at PH) and routes
// to Todo 8 (flatten + 201 filing reads the locked strokes).

function getPhilippineTime(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const envelopeId = Number(id);
    if (!Number.isInteger(envelopeId) || envelopeId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid envelope id" },
        { status: 400 }
      );
    }

    const body: unknown = await req.json().catch(() => null);
    const validation = FinishSigningEnvelopeSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const envelope = (await dFetch(`/items/signing_envelopes/${envelopeId}`)) as {
      data?: Record<string, unknown>;
    };
    const row = envelope?.data ?? null;
    if (!row) {
      return NextResponse.json(
        { success: false, message: "Envelope not found" },
        { status: 404 }
      );
    }
    if (row["status"] === "finished") {
      return NextResponse.json(
        { success: false, message: "Envelope is already locked" },
        { status: 409 }
      );
    }

    // Access gate: hiree sessions finish ONLY their own envelope; HR may
    // override any envelope. Both paths are logged (finishedBy below).
    const actor = validation.data.actor;
    const envelopeProfileId = Number(row["profile_id"]);
    if (actor.role === "hiree" && actor.profile_id !== envelopeProfileId) {
      return NextResponse.json(
        { success: false, message: "You can only finish your own envelope" },
        { status: 403 }
      );
    }

    // Template zones are read server-side (single source of truth).
    const templateId = Number(row["template_id"]);
    const template = (await dFetch(`/items/paperwork_templates/${templateId}`)) as {
      data?: Record<string, unknown>;
    };
    if (!template?.data) {
      return NextResponse.json(
        { success: false, message: "Template not found for this envelope" },
        { status: 404 }
      );
    }
    const rawZones = template.data["zones"];
    let zones: PaperworkZone[] = [];
    if (Array.isArray(rawZones)) {
      zones = rawZones as PaperworkZone[];
    } else if (typeof rawZones === "string" && rawZones.trim() !== "") {
      try {
        const parsed: unknown = JSON.parse(rawZones);
        if (Array.isArray(parsed)) zones = parsed as PaperworkZone[];
      } catch {
        zones = [];
      }
    }

    // Merge freehand ink + placed stamps, then gate SOLELY on the predicate.
    let merged;
    try {
      const ink = parseInk(JSON.stringify(validation.data.ink));
      merged = mergeStampsIntoInk(
        ink,
        validation.data.stamps ?? [],
        validation.data.pageSizes
      );
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid stroke payload: ink model is malformed" },
        { status: 400 }
      );
    }
    const verdict = isPaperworkValid(zones, merged, validation.data.pageSizes);
    if (!verdict.valid) {
      return NextResponse.json(
        { success: false, message: `Envelope is not ready to finish: ${verdict.reason ?? "invalid"}` },
        { status: 422 }
      );
    }

    // Lock: persist the finished content (with finishedBy log) + status.
    const now = getPhilippineTime();
    const content: SigningEnvelopeContent = {
      ink: JSON.parse(JSON.stringify(merged)) as SigningEnvelopeContent["ink"],
      stamps: validation.data.stamps ?? [],
      finishedBy: { role: actor.role, profile_id: actor.profile_id },
    };
    const updated = (await dFetch(`/items/signing_envelopes/${envelopeId}`, {
      method: "PATCH",
      body: JSON.stringify({
        strokes: JSON.stringify(content),
        status: "finished",
        finished_at: now,
        updated_at: now,
      }),
    })) as { data?: Record<string, unknown> };

    return NextResponse.json({
      success: true,
      data: updated?.data ? normalizeSigningEnvelope(updated.data) : null,
      message: `Envelope finished by ${actor.role}`,
    });
  } catch (error) {
    console.error("[onboarding-signing-envelopes] finish error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
