import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { normalizeSigningEnvelope } from "../../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/hrm/onboarding/signing-envelopes/[id]/file — 201 filing link.
//
// Write order (Todo 8): upload → persist returned `data.id` → link. This
// route is the LINK step only: the client uploads PDF bytes through the
// EXISTING `?type=employee_file` route first (validation reused, never
// re-implemented here) and passes the returned Directus file UUID as
// `fileId`. Linking before the UUID exists is rejected (400).
//
// `pdf_file` is SET once at filing; a re-file overwrites only with a new
// vault version + reason (409 otherwise). Orphan-file cleanup: when the 201
// record create fails AFTER the envelope patch, the staged upload is
// deleted (`DELETE /files/:id`) so no unlinked file lingers in
// `201_emp_files`; the vault retains staging and the client retries.
//
// DIRECTUS_STATIC_TOKEN never leaves the server (dFetch only); the browser
// talks to this route + the existing upload route, never Directus.
// Staging TTL (24h) is documented in `signingVault.ts` (VAULT_STAGING_TTL_MS).

function getPhilippineTime(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

const fileLinkSchema = z
  .object({
    fileId: z.string().min(1).max(128),
    record: z
      .object({
        user_id: z.number().int().positive(),
        list_id: z.number().int().positive(),
        record_name: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
      })
      .strict(),
    reason: z.string().max(2000).optional(),
  })
  .strict();

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

async function deleteStagedFile(fileId: string): Promise<void> {
  try {
    await dFetch(`/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
  } catch (error) {
    console.error("[onboarding-signing-envelopes] orphan cleanup failed:", error);
  }
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
    const validation = fileLinkSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }
    const { fileId, record, reason } = validation.data;

    const envelope = (await dFetch(`/items/signing_envelopes/${envelopeId}`)) as {
      data?: Record<string, unknown>;
    };
    const row = envelope?.data ?? null;
    if (!row) {
      await deleteStagedFile(fileId);
      return NextResponse.json(
        { success: false, message: "Envelope not found — staged upload cleaned up" },
        { status: 404 }
      );
    }
    if (row["status"] !== "finished") {
      await deleteStagedFile(fileId);
      return NextResponse.json(
        {
          success: false,
          message: "Only locked (finished) envelopes can file — staged upload cleaned up",
        },
        { status: 422 }
      );
    }

    // SET-once: re-file needs a new vault version + reason.
    const existingPdf = row["pdf_file"];
    const alreadyFiled =
      existingPdf !== null && existingPdf !== undefined && String(existingPdf) !== "";
    const version =
      alreadyFiled && typeof row["pdf_file"] === "string" ? 2 : alreadyFiled ? 2 : 1;
    if (alreadyFiled && (!reason || reason.trim() === "")) {
      return NextResponse.json(
        {
          success: false,
          message: "Envelope already filed — re-file overwrites only with a new vault version + reason",
        },
        { status: 409 }
      );
    }

    const now = getPhilippineTime();
    const updated = (await dFetch(`/items/signing_envelopes/${envelopeId}`, {
      method: "PATCH",
      body: JSON.stringify({ pdf_file: fileId, updated_at: now }),
    })) as { data?: Record<string, unknown> };

    // 201 link: create the employee file record carrying the file UUID.
    let recordId: number | null = null;
    try {
      const created = (await dFetch("/items/employee_file_records", {
        method: "POST",
        body: JSON.stringify({
          user_id: record.user_id,
          list_id: record.list_id,
          record_name: record.record_name,
          description: record.description ?? null,
          file_ref: fileId,
          is_deleted: 0,
          created_at: now,
          updated_at: now,
        }),
      })) as { data?: Record<string, unknown> };
      const rawId = created?.data?.["id"];
      recordId = typeof rawId === "number" ? rawId : Number(rawId ?? NaN);
      if (!Number.isFinite(recordId)) recordId = null;
    } catch (error) {
      console.error("[onboarding-signing-envelopes] 201 link failed:", error);
    }

    if (recordId === null) {
      // Link failed: orphan cleanup — delete the staged upload so no
      // unlinked file lingers; the vault retains staging, retry resumes.
      await deleteStagedFile(fileId);
      return NextResponse.json(
        {
          success: false,
          message: "201 link failed — staged upload cleaned up, retry resumes from the locked envelope",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        envelope: updated?.data ? normalizeSigningEnvelope(updated.data) : null,
        fileId,
        recordId,
        version,
      },
      message:
        version > 1
          ? `Envelope re-filed as vault version ${version}`
          : "Envelope filed to 201",
    });
  } catch (error) {
    console.error("[onboarding-signing-envelopes] file error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
