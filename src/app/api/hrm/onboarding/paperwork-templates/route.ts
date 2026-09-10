import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  CreatePaperworkTemplateSchema,
  type PaperworkTemplate,
  type PaperworkZone,
} from "@/modules/human-resource-management/onboarding/paperwork/types/paperwork-template.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/paperwork-templates — list (+ `?company_key=`
// legacy per-company filter; app-level key, NOT a UNIQUE column).
// POST /api/hrm/onboarding/paperwork-templates — create; zones default to []
// (freeform-ink-only template), is_active defaults true. Todo 20:
// `company_key` is legacy read-fallback — accepted when present (degraded
// writes, old rows) but never required; company scoping lives in the
// `paperwork_template_companies` junction via the `[id]/companies` route.

function getPhilippineTime(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

// Directus reads booleans back as 0/1 and json columns back as string|null —
// normalize so the envelope always matches PaperworkTemplateSchema. Task 16:
// `source`/`pdf_file` are owner-added columns — rows written before they
// exist read back without the keys, so default to the HTML contract here;
// writes carrying the new fields surface NEEDS-CREATION when Directus
// rejects unknown fields (asserted in task-16 evidence, never migrated).
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
    // Legacy key may be absent on junction-scoped rows — coerce to "" so
    // the envelope type stays string while the junction owns scoping.
    company_key:
      typeof row["company_key"] === "string" ? row["company_key"] : "",
    zones,
    is_active: active === true || active === 1 || active === "1",
    // PDF-only: every template reads as pdf regardless of stored value.
    source: "pdf",
    pdf_file: pdfFile,
  } as PaperworkTemplate;
}

const listQuerySchema = z
  .object({
    company_key: z.string().min(1).optional(),
  })
  .strict();

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = listQuerySchema.safeParse(params);
    if (!query.success) {
      return validationFailed(query.error.flatten().fieldErrors);
    }

    const filter = query.data.company_key
      ? `?filter[company_key][_eq]=${encodeURIComponent(query.data.company_key)}&limit=100`
      : "?limit=100";
    const result = (await dFetch(`/items/paperwork_templates${filter}`)) as {
      data?: Record<string, unknown>[];
    };
    const rows = Array.isArray(result?.data) ? result.data : [];
    return NextResponse.json({ success: true, data: rows.map(normalize) });
  } catch (error) {
    console.error("[onboarding-paperwork-templates] list error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    const validation = CreatePaperworkTemplateSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const now = getPhilippineTime();
    // Legacy `company_key` is written ONLY when the caller supplies it
    // (degraded-path writes); the dialog's normal path sends none — the
    // junction replace route owns company scoping.
    const payload: Record<string, unknown> = {
      title: validation.data.title,
      zones: validation.data.zones ?? [],
      is_active: validation.data.is_active ?? true,
      source: "pdf",
      pdf_file: validation.data.pdf_file ?? null,
      created_at: now,
      updated_at: now,
    };
    if (validation.data.company_key !== undefined) {
      payload["company_key"] = validation.data.company_key;
    }
    const created = (await dFetch("/items/paperwork_templates", {
      method: "POST",
      body: JSON.stringify(payload),
    })) as { data?: Record<string, unknown> };

    if (!created?.data) {
      console.error(
        "[onboarding-paperwork-templates] create returned no row; " +
          "if paperwork_templates.source|pdf_file are missing in Directus, " +
          "report NEEDS-CREATION:paperwork_templates.source|pdf_file (owner adds, never auto-migrated)."
      );
      return NextResponse.json(
        {
          success: false,
          message:
            "Template could not be created. If this persists, report NEEDS-CREATION:paperwork_templates.source|pdf_file.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: created?.data ? normalize(created.data) : null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[onboarding-paperwork-templates] create error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
