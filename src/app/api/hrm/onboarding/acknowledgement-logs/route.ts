import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  CreateAcknowledgementLogSchema,
  type AcknowledgementLog,
} from "@/modules/human-resource-management/onboarding/verification/types/acknowledgement-log.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// acknowledgement-logs — the audit-trail store (Todo 10 greenfield WRITE).
// Vault (`signing_envelopes.pdf_file`, Todo 8) is NEVER touched here: the
// signed file and the ack log are separate stores, separate writes.
//
// GET /api/hrm/onboarding/acknowledgement-logs — read/trail path (exact
// `?doc_ref=`, optional exact `?signer=`), newest-first.
// POST — record one ack `{doc_ref, signer, acknowledged_at (PH), method}`.
// Double-ack collapses to ONE row: exact-triple pre-check first, then insert;
// a UNIQUE-conflict body (Directus answers 400 RECORD_NOT_UNIQUE, never 409)
// re-reads the triple and returns the single surviving row (Todo 2 precedent).

function getPhilippineTime(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

function tripleFilter(docRef: string, signer: string, at: string): string {
  return (
    `filter[doc_ref][_eq]=${encodeURIComponent(docRef)}` +
    `&filter[signer][_eq]=${encodeURIComponent(signer)}` +
    `&filter[acknowledged_at][_eq]=${encodeURIComponent(at)}`
  );
}

async function findTriple(
  docRef: string,
  signer: string,
  at: string
): Promise<AcknowledgementLog | null> {
  const result = (await dFetch(
    `/items/acknowledgement_logs?${tripleFilter(docRef, signer, at)}&fields=id&limit=1`
  )) as { data?: AcknowledgementLog[] };
  const rows = Array.isArray(result?.data) ? result.data : [];
  return rows.length > 0 ? rows[0] : null;
}

// dFetch returns parsed error JSON instead of throwing, so uniqueness
// conflicts are detected by matching the body (ensureOnboardingProfile idiom:
// match the body, not just the status).
function isDuplicateBody(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const text = JSON.stringify(value);
  return /record_not_unique|has to be unique|must be unique|\bduplicate\b|already exists/i.test(
    text
  );
}

const listQuerySchema = z
  .object({
    doc_ref: z.string().min(1).max(255).optional(),
    signer: z.string().min(1).max(120).optional(),
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
    if (query.data.doc_ref !== undefined) {
      filters.push(`filter[doc_ref][_eq]=${encodeURIComponent(query.data.doc_ref)}`);
    }
    if (query.data.signer !== undefined) {
      filters.push(`filter[signer][_eq]=${encodeURIComponent(query.data.signer)}`);
    }
    const suffix =
      filters.length > 0
        ? `?${filters.join("&")}&sort=-acknowledged_at&limit=200`
        : "?sort=-acknowledged_at&limit=200";
    const result = (await dFetch(`/items/acknowledgement_logs${suffix}`)) as {
      data?: AcknowledgementLog[];
    };
    const rows = Array.isArray(result?.data) ? result.data : [];
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("[onboarding-acknowledgement-logs] list error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    const validation = CreateAcknowledgementLogSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const docRef = validation.data.doc_ref.trim();
    const signer = validation.data.signer.trim();
    const at = (validation.data.acknowledged_at ?? "").trim() || getPhilippineTime();

    const preExisting = await findTriple(docRef, signer, at);
    if (preExisting) {
      return NextResponse.json({
        success: true,
        data: preExisting,
        message: "Acknowledgement already recorded",
      });
    }

    const now = getPhilippineTime();
    const created = (await dFetch("/items/acknowledgement_logs", {
      method: "POST",
      body: JSON.stringify({
        doc_ref: docRef,
        signer,
        acknowledged_at: at,
        method: validation.data.method,
        created_at: now,
        updated_at: now,
      }),
    })) as { data?: AcknowledgementLog };

    if (created?.data) {
      return NextResponse.json(
        { success: true, data: created.data },
        { status: 201 }
      );
    }

    // No `data` back: either a duplicate another writer won (collapse to the
    // single row) or a real failure (500). Match the body, not the status.
    if (isDuplicateBody(created)) {
      const winner = await findTriple(docRef, signer, at);
      if (winner) {
        return NextResponse.json({
          success: true,
          data: winner,
          message: "Acknowledgement already recorded",
        });
      }
    }
    console.error("[onboarding-acknowledgement-logs] create failed: no data");
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  } catch (error) {
    console.error("[onboarding-acknowledgement-logs] create error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
