import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  assertHireeScope,
  readHireeScope,
} from "@/modules/human-resource-management/employee-portal";
import { normalizeSigningEnvelope } from "../../signing-envelopes/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/portal/envelopes?profile_id=<id> — signing entry
// pre-scoped to the hiree's OWN envelopes (Todo 7 surface consumes the
// selected envelope; this route never rebuilds it). Proxies the
// signing-envelopes read path filtered to the session's own profile id.
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

    const result = (await dFetch(
      `/items/signing_envelopes?filter[profile_id][_eq]=${query.data.profile_id}&limit=100`
    )) as { data?: Record<string, unknown>[] };
    const rows = Array.isArray(result?.data) ? result.data : [];
    return NextResponse.json({
      success: true,
      data: rows.map(normalizeSigningEnvelope),
    });
  } catch (error) {
    console.error("[onboarding-portal] envelopes error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
