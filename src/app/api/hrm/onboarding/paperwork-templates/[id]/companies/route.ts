import { NextRequest, NextResponse } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  ReplacePaperworkTemplateCompaniesSchema,
  type PaperworkTemplateCompany,
} from "@/modules/human-resource-management/onboarding/paperwork/types/paperwork-template-company.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/paperwork-templates/[id]/companies — one template's
// junction rows (dialog initial selection).
// PUT …/[id]/companies — REPLACE the template's company set: delete-all +
// re-insert in this one route call (house precedent: `quiz_category_filter`
// replace-all, `company_memo_per_companies` delete+insert). Never partial from
// the caller's view — the full set travels in one strict body. Duplicate ids
// collapse to a single row (UNIQUE pair, never doubled). Empty sets are
// rejected with a reason (a template must scope to ≥1 company).

function getPhilippineTime(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

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

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function templateExists(templateId: number): Promise<boolean> {
  const current = (await dFetch(
    `/items/paperwork_templates/${templateId}`
  )) as { data?: Record<string, unknown>; errors?: unknown };
  return Boolean(current?.data && !current?.errors);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const templateId = parseId(id);
    if (templateId === null) {
      return NextResponse.json(
        { success: false, message: "Invalid template id" },
        { status: 400 }
      );
    }
    const result = (await dFetch(
      `/items/paperwork_template_companies?filter[template_id][_eq]=${templateId}&limit=-1`
    )) as { data?: Record<string, unknown>[] };
    const rows = Array.isArray(result?.data) ? result.data : [];
    return NextResponse.json({ success: true, data: rows.map(normalize) });
  } catch (error) {
    console.error("[onboarding-template-companies] list error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const templateId = parseId(id);
    if (templateId === null) {
      return NextResponse.json(
        { success: false, message: "Invalid template id" },
        { status: 400 }
      );
    }

    const body: unknown = await req.json().catch(() => null);
    const validation = ReplacePaperworkTemplateCompaniesSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    if (!(await templateExists(templateId))) {
      return NextResponse.json(
        { success: false, message: "Template not found" },
        { status: 404 }
      );
    }

    // UNIQUE-pair collapse: duplicate pair → single row, never doubled.
    const companyIds = [...new Set(validation.data.company_ids)];

    const existing = (await dFetch(
      `/items/paperwork_template_companies?filter[template_id][_eq]=${templateId}&limit=-1&fields=id`
    )) as { data?: { id?: number }[] };
    const oldRows = Array.isArray(existing?.data) ? existing.data : [];
    await Promise.all(
      oldRows
        .filter((row) => typeof row?.id === "number")
        .map((row) =>
          dFetch(`/items/paperwork_template_companies/${row.id}`, {
            method: "DELETE",
          })
        )
    );

    const now = getPhilippineTime();
    const created = await Promise.all(
      companyIds.map(async (companyId) => {
        const row = (await dFetch("/items/paperwork_template_companies", {
          method: "POST",
          body: JSON.stringify({
            template_id: templateId,
            company_id: companyId,
            created_at: now,
            updated_at: now,
          }),
        })) as { data?: Record<string, unknown> };
        if (!row?.data) {
          throw new Error(
            `Junction insert failed for company ${companyId}; ` +
              "re-run the save to converge (delete-then-insert is re-runnable)."
          );
        }
        return normalize(row.data);
      })
    );

    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error("[onboarding-template-companies] replace error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again later.",
      },
      { status: 500 }
    );
  }
}
