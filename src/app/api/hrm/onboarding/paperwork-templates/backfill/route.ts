import { NextResponse } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/hrm/onboarding/paperwork-templates/backfill — one-shot migration
// of legacy `company_key` values into `paperwork_template_companies` rows.
// For each template: resolve its `company_key` via the `company_list`
// directory (code→id); insert the pair when absent; skip present pairs.
// Unresolvable keys are REPORTED as legacy-fallback (never deleted, never
// altered — zero data loss). Idempotent: re-runs converge to zero inserts.

function getPhilippineTime(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

interface TemplateRow {
  id?: number;
  company_key?: unknown;
}

interface DirectoryRow {
  company_id?: unknown;
  company_code?: unknown;
}

interface JunctionRow {
  template_id?: unknown;
  company_id?: unknown;
}

export async function POST() {
  try {
    const [templatesRes, directoryRes, junctionRes] = await Promise.all([
      dFetch("/items/paperwork_templates?limit=-1&fields=id,company_key"),
      dFetch("/items/company_list?fields=company_id,company_code&limit=-1"),
      dFetch(
        "/items/paperwork_template_companies?limit=-1&fields=template_id,company_id"
      ),
    ]);

    const templates: TemplateRow[] = Array.isArray(
      (templatesRes as { data?: unknown })?.data
    )
      ? ((templatesRes as { data: TemplateRow[] }).data as TemplateRow[])
      : [];
    const directory: DirectoryRow[] = Array.isArray(
      (directoryRes as { data?: unknown })?.data
    )
      ? ((directoryRes as { data: DirectoryRow[] }).data as DirectoryRow[])
      : [];
    const junction: JunctionRow[] = Array.isArray(
      (junctionRes as { data?: unknown })?.data
    )
      ? ((junctionRes as { data: JunctionRow[] }).data as JunctionRow[])
      : [];

    const codeToId = new Map<string, number>();
    for (const row of directory) {
      const code =
        typeof row?.company_code === "string"
          ? row.company_code.trim()
          : "";
      const id =
        typeof row?.company_id === "number"
          ? row.company_id
          : typeof row?.company_id === "string"
            ? Number(row.company_id)
            : NaN;
      if (code !== "" && Number.isInteger(id) && id > 0 && !codeToId.has(code)) {
        codeToId.set(code, id);
      }
    }

    const present = new Set<string>();
    for (const row of junction) {
      present.add(`${Number(row?.template_id)}:${Number(row?.company_id)}`);
    }

    const now = getPhilippineTime();
    let inserted = 0;
    let skippedPresent = 0;
    const unresolvable: { template_id: number; company_key: string }[] = [];

    for (const template of templates) {
      if (typeof template?.id !== "number") continue;
      const key =
        typeof template?.company_key === "string"
          ? template.company_key.trim()
          : "";
      if (key === "") continue;
      const companyId = codeToId.get(key);
      if (companyId === undefined) {
        // Legacy-fallback: keep the row untouched, report for HR review.
        unresolvable.push({ template_id: template.id, company_key: key });
        continue;
      }
      if (present.has(`${template.id}:${companyId}`)) {
        skippedPresent += 1;
        continue;
      }
      const created = (await dFetch("/items/paperwork_template_companies", {
        method: "POST",
        body: JSON.stringify({
          template_id: template.id,
          company_id: companyId,
          created_at: now,
          updated_at: now,
        }),
      })) as { data?: Record<string, unknown> };
      if (!created?.data) {
        console.error(
          `[onboarding-backfill] insert returned no row for template ${template.id} company ${companyId}`
        );
        return NextResponse.json(
          {
            success: false,
            message: `Backfill stopped: junction insert failed for template ${template.id}. Re-run to resume (completed pairs are skipped).`,
          },
          { status: 502 }
        );
      }
      present.add(`${template.id}:${companyId}`);
      inserted += 1;
    }

    return NextResponse.json({
      success: true,
      data: {
        templates_total: templates.length,
        inserted,
        skipped_present: skippedPresent,
        unresolvable,
      },
    });
  } catch (error) {
    console.error("[onboarding-backfill] error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
