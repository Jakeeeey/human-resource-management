import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { buildFilingFilename, VAULT_FOLDER } from "@/modules/human-resource-management/onboarding/signing/signingVault";
import {
  burnInkIntoTemplatePdf,
  PDF_BURN_TEMPLATE_MAX_BYTES,
} from "@/modules/human-resource-management/onboarding/signing/server/pdfBurnCore";
import type { SigningEnvelopeContent } from "@/modules/human-resource-management/onboarding/signing/types/signing-envelope.schema";
import { normalizeSigningEnvelope } from "../../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/hrm/onboarding/signing-envelopes/[id]/pdf-burn — Todo 18.
//
// Finished PDF envelopes only: burns the LOCKED envelope strokes into the
// trusted admin-template PDF server-side via `pdf-lib`, then files
// upload → `data.id` → link (same order/cleanup rules as Todo 8).
//
// Trust boundary: `PDFDocument.load` receives ONLY the admin-template bytes
// fetched server-side from Directus `/assets` (token stays server-side).
// Hiree-uploaded PDF bytes never reach the parser. Ink comes from the
// LOCKED envelope row (server-read), never from the client body — the client
// sends only the 201 record intent + renderer-owned page sizes (+ optional
// stamp PNGs, redundant with the persisted stamp vectors).
//
// `pdf_file` is SET once at filing; a re-file overwrites only with a reason
// (409 otherwise). Orphan-file cleanup: when the 201 link fails AFTER the
// upload, the staged file is deleted (`DELETE /files/:id`).

const PDF_BURN_FETCH_TIMEOUT_MS = 15_000;

const pdfBurnSchema = z
  .object({
    record: z
      .object({
        user_id: z.number().int().positive(),
        list_id: z.number().int().positive(),
        record_name: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
      })
      .strict(),
    reason: z.string().max(2000).optional(),
    pageSizes: z
      .record(
        z.coerce.number().int().positive(),
        z
          .object({
            width: z.number().positive().max(8000),
            height: z.number().positive().max(8000),
          })
          .strict()
      )
      .refine((sizes) => Object.keys(sizes).length >= 1, {
        message: "pageSizes must cover at least one page",
      })
      .refine((sizes) => Object.keys(sizes).length <= 500, {
        message: "pageSizes covers too many pages",
      }),
    stampPngs: z
      .array(
        z
          .object({
            stampId: z.string().min(1).max(64),
            pngDataUrl: z.string().min(1).max(3_000_000),
          })
          .strict()
      )
      .max(50)
      .optional(),
  })
  .strict()
  .refine(
    (body) =>
      !Array.isArray(body.stampPngs) ||
      body.stampPngs.reduce((total, entry) => total + entry.pngDataUrl.length, 0) <=
        20_000_000,
    { message: "stamp images exceed the total upload budget" }
  );

function getPhilippineTime(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

function statusForBurnError(message: string): number {
  if (message.includes("FILE_TOO_LARGE_413")) return 413;
  if (message.includes("STAMP_PNG_TOO_LARGE_413")) return 413;
  if (message.includes("INK_TOO_LARGE_413")) return 413;
  if (message.includes("_422")) return 422;
  if (message.includes("_504")) return 504;
  if (message.includes("_502")) return 502;
  return 500;
}

async function deleteStagedFile(fileId: string): Promise<void> {
  try {
    await dFetch(`/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
  } catch (error) {
    console.error("[onboarding-pdf-burn] orphan cleanup failed:", error);
  }
}

function parseLockedContent(raw: unknown): SigningEnvelopeContent | null {
  try {
    const text = typeof raw === "string" ? raw : JSON.stringify(raw ?? null);
    if (!text || text.trim() === "") return null;
    const parsed = JSON.parse(text) as SigningEnvelopeContent;
    if (!parsed || typeof parsed !== "object" || !("ink" in parsed)) return null;
    return parsed;
  } catch {
    return null;
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
    const validation = pdfBurnSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }
    const { record, reason, pageSizes, stampPngs } = validation.data;

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
    if (row["status"] !== "finished") {
      return NextResponse.json(
        { success: false, message: "Only locked (finished) envelopes can file" },
        { status: 422 }
      );
    }

    // SET-once: re-file needs a reason (checked BEFORE any upload — nothing
    // staged yet, so no orphan to clean on this path).
    const existingPdf = row["pdf_file"];
    const alreadyFiled =
      existingPdf !== null && existingPdf !== undefined && String(existingPdf) !== "";
    const version = alreadyFiled ? 2 : 1;
    if (alreadyFiled && (!reason || reason.trim() === "")) {
      return NextResponse.json(
        {
          success: false,
          message: "Envelope already filed — re-file overwrites only with a new vault version + reason",
        },
        { status: 409 }
      );
    }

    const content = parseLockedContent(row["strokes"]);
    if (!content) {
      return NextResponse.json(
        { success: false, message: "Locked envelope has no ink to burn" },
        { status: 422 }
      );
    }

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
    const rawPdf = template.data["pdf_file"];
    const pdfFileId =
      typeof rawPdf === "string" && rawPdf !== ""
        ? rawPdf
        : rawPdf !== null &&
            typeof rawPdf === "object" &&
            typeof (rawPdf as { id?: unknown }).id === "string"
          ? (rawPdf as { id: string }).id
          : null;
    if (template.data["source"] !== "pdf" || pdfFileId === null) {
      return NextResponse.json(
        { success: false, message: "Template has no PDF file to burn into" },
        { status: 422 }
      );
    }

    // Trusted admin-template bytes ONLY — fetched server-side (token stays
    // server-side). Hiree-uploaded bytes never flow through this route.
    const base = process.env.NEXT_PUBLIC_API_BASE_URL;
    const token = process.env.DIRECTUS_STATIC_TOKEN;
    if (!base || !token) {
      console.error("[onboarding-pdf-burn] Directus env missing");
      return NextResponse.json(
        { success: false, message: "An unexpected error occurred. Please try again later." },
        { status: 500 }
      );
    }
    const upstream = await fetch(`${base}/assets/${encodeURIComponent(pdfFileId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(PDF_BURN_FETCH_TIMEOUT_MS),
    }).catch(() => null);
    if (!upstream || !upstream.ok || !upstream.body) {
      console.error("[onboarding-pdf-burn] asset fetch failed");
      return NextResponse.json(
        { success: false, message: "Template PDF could not be loaded" },
        { status: 502 }
      );
    }
    const declared = upstream.headers.get("content-length");
    const declaredSize = declared === null ? NaN : Number(declared);
    if (Number.isFinite(declaredSize) && declaredSize > PDF_BURN_TEMPLATE_MAX_BYTES) {
      void upstream.body?.cancel().catch(() => undefined);
      return NextResponse.json(
        {
          success: false,
          message: `Template PDF exceeds the 10MB cap (${declaredSize} bytes)`,
        },
        { status: 413 }
      );
    }
    const assetBuffer = await upstream.arrayBuffer();
    if (assetBuffer.byteLength === 0) {
      return NextResponse.json(
        { success: false, message: "Template PDF is empty" },
        { status: 502 }
      );
    }
    if (assetBuffer.byteLength > PDF_BURN_TEMPLATE_MAX_BYTES) {
      return NextResponse.json(
        {
          success: false,
          message: `Template PDF exceeds the 10MB cap (${assetBuffer.byteLength} bytes)`,
        },
        { status: 413 }
      );
    }
    const magic = new Uint8Array(assetBuffer.slice(0, 5));
    const pdfMagic = [0x25, 0x50, 0x44, 0x46, 0x2d];
    const magicOk =
      magic.length === pdfMagic.length &&
      pdfMagic.every((byte, index) => magic[index] === byte);
    if (!magicOk) {
      return NextResponse.json(
        { success: false, message: "Template file is not a PDF document" },
        { status: 502 }
      );
    }
    const templateBytes = new Uint8Array(assetBuffer);

    let burned;
    try {
      burned = await burnInkIntoTemplatePdf({
        templateBytes,
        ink: content.ink as BurnInk,
        stamps: content.stamps ?? [],
        pageSizes,
        stampPngs: stampPngs ?? [],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[onboarding-pdf-burn] burn rejected:", message);
      return NextResponse.json(
        { success: false, message: message },
        { status: statusForBurnError(message) }
      );
    }
    if (burned.bytes.byteLength === 0) {
      return NextResponse.json(
        { success: false, message: "Burn produced zero bytes — rejected, never filed" },
        { status: 502 }
      );
    }

    // Upload through Directus (same folder + ceiling as `?type=employee_file`).
    const envelopeKey =
      typeof row["envelope_key"] === "string" && row["envelope_key"] !== ""
        ? (row["envelope_key"] as string)
        : `${row["profile_id"]}:${templateId}:1`;
    const filename = buildFilingFilename(envelopeKey, version);
    let folderId: string | undefined;
    try {
      const folderRes = await fetch(
        `${base}/folders?filter[name][_eq]=${VAULT_FOLDER}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (folderRes.ok) {
        const folderData = (await folderRes.json()) as {
          data?: { id?: string }[];
        };
        if (folderData.data && folderData.data.length > 0) {
          folderId = folderData.data[0]?.id;
        }
      }
    } catch (error) {
      console.error("[onboarding-pdf-burn] folder resolve failed:", error);
    }
    const outgoing = new FormData();
    if (folderId) outgoing.append("folder", folderId);
    outgoing.append(
      "file",
      new Blob([burned.bytes as unknown as BlobPart], { type: "application/pdf" }),
      filename
    );
    const uploadRes = await fetch(`${base}/files`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: outgoing,
    }).catch(() => null);
    const uploaded = (await uploadRes?.json().catch(() => null)) as {
      data?: { id?: string };
    } | null;
    const fileId = uploadRes && uploadRes.ok ? uploaded?.data?.id : undefined;
    if (!fileId) {
      console.error("[onboarding-pdf-burn] upload failed");
      return NextResponse.json(
        { success: false, message: "Filing upload was rejected by the vault" },
        { status: 502 }
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
      console.error("[onboarding-pdf-burn] 201 link failed:", error);
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
    console.error("[onboarding-pdf-burn] burn error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

type BurnInk = Parameters<typeof burnInkIntoTemplatePdf>[0]["ink"];
