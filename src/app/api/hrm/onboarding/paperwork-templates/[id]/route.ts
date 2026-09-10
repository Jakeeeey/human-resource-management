import { NextRequest, NextResponse } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  UpdatePaperworkTemplateSchema,
  type PaperworkTemplate,
  type PaperworkZone,
} from "@/modules/human-resource-management/onboarding/paperwork/types/paperwork-template.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/paperwork-templates/[id] — single template (404
// when absent). Zones arrive as the stored zones[] document.
// PATCH /api/hrm/onboarding/paperwork-templates/[id] — partial update; zones
// replace wholesale (template_id → zones[] is one document, no per-zone
// routes). Todo 7 reads zones from GET; the zones editor writes via PATCH.

function getPhilippineTime(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

function normalize(row: Record<string, unknown>): PaperworkTemplate {
  const rawZones = row["zones"];
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
  const active = row["is_active"];
  const rawPdfFile = row["pdf_file"];
  const pdfFile =
    typeof rawPdfFile === "string" && rawPdfFile !== ""
      ? rawPdfFile
      : rawPdfFile !== null &&
          typeof rawPdfFile === "object" &&
          typeof (rawPdfFile as { id?: unknown }).id === "string"
        ? (rawPdfFile as { id: string }).id
        : null;
  return {
    ...(row as object),
    zones,
    is_active: active === true || active === 1 || active === "1",
    // PDF-only: every template reads as pdf regardless of stored value.
    source: "pdf",
    pdf_file: pdfFile,
  } as PaperworkTemplate;
}

function coherenceError(message: string) {
  return NextResponse.json({ success: false, message }, { status: 400 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const templateId = Number(id);
    if (!Number.isInteger(templateId) || templateId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid template id" },
        { status: 400 }
      );
    }

    const result = (await dFetch(
      `/items/paperwork_templates/${templateId}`
    )) as { data?: Record<string, unknown> };
    if (!result?.data) {
      return NextResponse.json(
        { success: false, message: "Template not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: normalize(result.data) });
  } catch (error) {
    console.error("[onboarding-paperwork-templates] fetch error:", error);
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
    const templateId = Number(id);
    if (!Number.isInteger(templateId) || templateId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid template id" },
        { status: 400 }
      );
    }

    const body: unknown = await req.json().catch(() => null);
    const validation = UpdatePaperworkTemplateSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const current = (await dFetch(
      `/items/paperwork_templates/${templateId}`
    )) as { data?: Record<string, unknown> };
    if (!current?.data) {
      return NextResponse.json(
        { success: false, message: "Template not found" },
        { status: 404 }
      );
    }

    const data = validation.data;
    // PDF-only coherence: the resolved row must keep a file UUID. `body_html`
    // is never written (legacy column); `source`, when provided, must be "pdf".
    const storedPdf =
      typeof current.data["pdf_file"] === "string" &&
      current.data["pdf_file"] !== ""
        ? (current.data["pdf_file"] as string)
        : null;
    const nextPdf = data.pdf_file !== undefined ? data.pdf_file : storedPdf;
    if (!nextPdf) {
      return coherenceError("PDF file is required for PDF templates");
    }

    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch["title"] = data.title;
    if (data.zones !== undefined) patch["zones"] = data.zones;
    if (data.is_active !== undefined) patch["is_active"] = data.is_active;
    if (data.source !== undefined) patch["source"] = data.source;
    if (data.pdf_file !== undefined) patch["pdf_file"] = data.pdf_file;
    patch["updated_at"] = getPhilippineTime();

    const updated = (await dFetch(`/items/paperwork_templates/${templateId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    })) as { data?: Record<string, unknown> };

    if (!updated?.data) {
      console.error(
        "[onboarding-paperwork-templates] update returned no row; " +
          "if paperwork_templates.source|pdf_file are missing in Directus, " +
          "report NEEDS-CREATION:paperwork_templates.source|pdf_file (owner adds, never auto-migrated)."
      );
      return NextResponse.json(
        {
          success: false,
          message:
            "Template could not be updated. If this persists, report NEEDS-CREATION:paperwork_templates.source|pdf_file.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated?.data ? normalize(updated.data) : null,
    });
  } catch (error) {
    console.error("[onboarding-paperwork-templates] update error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
