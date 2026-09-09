import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  CreateSigningEnvelopeSchema,
  type SigningEnvelope,
} from "@/modules/human-resource-management/onboarding/signing/types/signing-envelope.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/signing-envelopes — list (+ `?profile_id=`,
// `?template_id=`, `?status=` filters so the Todo 7 surface + Todo 9 portal
// share one read path).
// POST /api/hrm/onboarding/signing-envelopes — open a draft envelope;
// `envelope_key` is composed server-side as
// `<profile_id>:<template_id>:<attempt>` (UNIQUE idempotency key —
// double-POST collapses via pre-check + duplicate-error swallow, Todo 2
// precedent). Draft creation persists NO ink — ink arrives only via the
// explicit PATCH Save-draft write (never silently).

function getPhilippineTime(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

// Directus reads text/json columns back as string|null — normalize so the
// envelope matches SigningEnvelopeSchema.
export function normalizeSigningEnvelope(
  row: Record<string, unknown>
): SigningEnvelope {
  const strokes = row["strokes"];
  const pdfFile = row["pdf_file"];
  return {
    ...(row as object),
    strokes:
      strokes === null || strokes === undefined
        ? null
        : typeof strokes === "string"
          ? strokes
          : JSON.stringify(strokes),
    pdf_file:
      pdfFile === null || pdfFile === undefined
        ? null
        : String(pdfFile),
  } as SigningEnvelope;
}

export function composeEnvelopeKey(
  profileId: number,
  templateId: number,
  attempt: number
): string {
  return `${profileId}:${templateId}:${attempt}`;
}

const listQuerySchema = z
  .object({
    profile_id: z.coerce.number().int().positive().optional(),
    template_id: z.coerce.number().int().positive().optional(),
    status: z.enum(["draft", "finished"]).optional(),
  })
  .strict();

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = listQuerySchema.safeParse(params);
    if (!query.success) {
      return validationFailed(query.error.flatten().fieldErrors);
    }

    const filters: string[] = [];
    if (query.data.profile_id !== undefined) {
      filters.push(`filter[profile_id][_eq]=${query.data.profile_id}`);
    }
    if (query.data.template_id !== undefined) {
      filters.push(`filter[template_id][_eq]=${query.data.template_id}`);
    }
    if (query.data.status !== undefined) {
      filters.push(`filter[status][_eq]=${query.data.status}`);
    }
    const suffix = filters.length > 0 ? `?${filters.join("&")}&limit=100` : "?limit=100";
    const result = (await dFetch(`/items/signing_envelopes${suffix}`)) as {
      data?: Record<string, unknown>[];
    };
    const rows = Array.isArray(result?.data) ? result.data : [];
    return NextResponse.json({
      success: true,
      data: rows.map(normalizeSigningEnvelope),
    });
  } catch (error) {
    console.error("[onboarding-signing-envelopes] list error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    const validation = CreateSigningEnvelopeSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const profileId = validation.data.profile_id;
    const templateId = validation.data.template_id;
    const attempt = validation.data.attempt ?? 1;
    const envelopeKey = composeEnvelopeKey(profileId, templateId, attempt);

    const existing = (await dFetch(
      `/items/signing_envelopes?filter[envelope_key][_eq]=${encodeURIComponent(envelopeKey)}&fields=id&limit=1`
    )) as { data?: unknown[] };
    if (Array.isArray(existing?.data) && existing.data.length > 0) {
      return NextResponse.json(
        { success: false, message: "An envelope already exists for this key" },
        { status: 409 }
      );
    }

    const now = getPhilippineTime();
    let created: { data?: Record<string, unknown> };
    try {
      created = (await dFetch("/items/signing_envelopes", {
        method: "POST",
        body: JSON.stringify({
          envelope_key: envelopeKey,
          profile_id: profileId,
          template_id: templateId,
          status: "draft",
          strokes: null,
          pdf_file: null,
          finished_at: null,
          created_at: now,
          updated_at: now,
        }),
      })) as { data?: Record<string, unknown> };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("RECORD_NOT_UNIQUE") || message.includes("envelope_key")) {
        return NextResponse.json(
          { success: false, message: "An envelope already exists for this key" },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        data: created?.data ? normalizeSigningEnvelope(created.data) : null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[onboarding-signing-envelopes] create error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
