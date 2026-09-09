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
  return {
    ...(row as object),
    zones,
    is_active: active === true || active === 1 || active === "1",
  } as PaperworkTemplate;
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
    const patch: Record<string, unknown> = {};
    if (data.company_key !== undefined) patch["company_key"] = data.company_key;
    if (data.title !== undefined) patch["title"] = data.title;
    if (data.body_html !== undefined) patch["body_html"] = data.body_html;
    if (data.zones !== undefined) patch["zones"] = data.zones;
    if (data.is_active !== undefined) patch["is_active"] = data.is_active;
    patch["updated_at"] = getPhilippineTime();

    const updated = (await dFetch(`/items/paperwork_templates/${templateId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    })) as { data?: Record<string, unknown> };

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
