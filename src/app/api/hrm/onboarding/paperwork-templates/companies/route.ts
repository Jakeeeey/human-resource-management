import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import type { PaperworkTemplateCompany } from "@/modules/human-resource-management/onboarding/paperwork/types/paperwork-template-company.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/paperwork-templates/companies — every junction row
// (`?template_id=` narrows to one template). Registry table + signing-desk
// filter build their template→companies maps from this in one call.

function normalize(row: Record<string, unknown>): PaperworkTemplateCompany {
  return {
    id: Number(row["id"]),
    template_id: Number(row["template_id"]),
    company_id: Number(row["company_id"]),
    created_at:
      typeof row["created_at"] === "string" ? row["created_at"] : null,
    created_by:
      typeof row["created_by"] === "number" ? row["created_by"] : null,
    updated_at:
      typeof row["updated_at"] === "string" ? row["updated_at"] : null,
    updated_by:
      typeof row["updated_by"] === "number" ? row["updated_by"] : null,
  };
}

const listQuerySchema = z
  .object({
    limit: z.string().optional(),
    template_id: z.string().optional(),
  })
  .strict();

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = listQuerySchema.safeParse(params);
    if (!query.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Validation failed",
          errors: query.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const limit = query.data.limit ?? "-1";
    const filter = query.data.template_id
      ? `filter[template_id][_eq]=${encodeURIComponent(query.data.template_id)}&`
      : "";
    const result = (await dFetch(
      `/items/paperwork_template_companies?${filter}limit=${encodeURIComponent(limit)}`
    )) as { data?: Record<string, unknown>[] };
    const rows = Array.isArray(result?.data) ? result.data : [];
    return NextResponse.json({ success: true, data: rows.map(normalize) });
  } catch (error) {
    console.error("[onboarding-template-companies] collection error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
