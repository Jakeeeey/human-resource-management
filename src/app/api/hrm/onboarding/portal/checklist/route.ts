import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  buildChecklist,
  portalMarkerPrefix,
  readPortalToken,
  resolvePortalIdentity,
} from "@/modules/human-resource-management/employee-portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/portal/checklist — the caller's OWN document
// checklist, keyed to the session-resolved identity (applicant pre-hire /
// employee post-hire). Filed state derives from the identity-keyed file
// markers stamped by the documents route, so upload -> UUID -> checklist
// round-trips through one read path. No `profile_id` query/header exists —
// there is nothing for the client to assert.

const FiledRowsSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().min(1),
      description: z.unknown(),
    })
  ),
});

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolvePortalIdentity(readPortalToken(req));
    if (!resolved.ok) {
      return NextResponse.json(
        { success: false, message: resolved.message },
        { status: resolved.status }
      );
    }

    const key = { kind: resolved.identity.kind, id: resolved.identity.id };
    const marker = portalMarkerPrefix(key);
    const body: unknown = await dFetch(
      `/files?filter[description][_contains]=${encodeURIComponent(marker)}&fields=id,description&limit=100`
    );
    const parsed = FiledRowsSchema.safeParse(body);
    if (!parsed.success) {
      throw new Error(
        `PORTAL_FILE_MARKER_READ_FAILED: ${JSON.stringify(body).slice(0, 300)}`
      );
    }

    return NextResponse.json({
      success: true,
      data: await buildChecklist(key, parsed.data.data),
    });
  } catch (error) {
    console.error("[onboarding-portal] checklist error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
