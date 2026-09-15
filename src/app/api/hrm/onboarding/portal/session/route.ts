import { NextRequest, NextResponse } from "next/server";

import {
  readPortalToken,
  resolvePortalIdentity,
} from "@/modules/human-resource-management/employee-portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/portal/session — resolves the caller's OWN hire
// identity server-side from the `vos_access_token` cookie (the Directus
// static token stays inside dFetch and never reaches the browser): an
// APPLICANT before hiring (the applicant-scoped signing key, todo 13) or an
// EMPLOYEE after the hire (`user.user_id`). No `onboarding_profiles` row and
// no client-asserted identity header is read anywhere.
// Rejects: no/undecodable session -> 401; readable session with no matching
// hire record -> 404.

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolvePortalIdentity(readPortalToken(req));
    if (!resolved.ok) {
      return NextResponse.json(
        { success: false, message: resolved.message },
        { status: resolved.status }
      );
    }
    return NextResponse.json({ success: true, data: resolved.identity });
  } catch (error) {
    console.error("[onboarding-portal] session error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
