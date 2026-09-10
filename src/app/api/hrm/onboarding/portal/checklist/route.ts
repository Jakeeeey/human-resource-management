import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  assertHireeScope,
  buildChecklist,
  readHireeScope,
} from "@/modules/human-resource-management/employee-portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/portal/checklist?profile_id=<id> — the hiree's OWN
// document checklist (required/optional from the hub config). Filed state is
// derived from the portal file-description markers, so
// upload→UUID→checklist-check round-trips through one read path.
// Access matrix: role=hr → 403; cross-hire profile_id → 403 (asserted).

const querySchema = z
  .object({
    profile_id: z.coerce.number().int().positive(),
  })
  .strict();

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = querySchema.safeParse(params);
    if (!query.success) {
      return NextResponse.json(
        { success: false, message: "Validation failed" },
        { status: 400 }
      );
    }

    const scope = assertHireeScope(
      readHireeScope(req.headers, query.data.profile_id)
    );
    if (!scope.ok) {
      return NextResponse.json(
        { success: false, message: scope.message },
        { status: scope.status }
      );
    }

    const marker = `onboarding-portal:${query.data.profile_id}:`;
    const result = (await dFetch(
      `/files?filter[description][_contains]=${encodeURIComponent(marker)}&fields=id,description&limit=100`
    )) as { data?: { id: string; description: unknown }[] };
    const rows = Array.isArray(result?.data) ? result.data : [];
    return NextResponse.json({
      success: true,
      data: buildChecklist(query.data.profile_id, rows),
    });
  } catch (error) {
    console.error("[onboarding-portal] checklist error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
