import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/portal/session — resolves the caller's OWN hire
// record server-side (DIRECTUS_STATIC_TOKEN stays in dFetch, never leaks to
// the browser). Reads the `vos_access_token` session cookie, decodes the
// employee id claim, and returns the matching onboarding profile pointer.
// HR staff without a hire record get 404 (their hub lives elsewhere).

const COOKIE_NAME = "vos_access_token";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const segment = parts[1] ?? "";
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

function pickEmployeeId(payload: Record<string, unknown> | null): number | null {
  if (!payload) return null;
  const candidates = [
    payload["employee_id"],
    payload["EmployeeId"],
    payload["employeeId"],
    payload["user_id"],
    payload["id"],
    payload["sub"],
  ];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isInteger(value) && value > 0) return value;
  }
  return null;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "A hiree session is required to access the portal" },
        { status: 401 }
      );
    }
    const employeeId = pickEmployeeId(decodeJwtPayload(token));
    if (employeeId === null) {
      return NextResponse.json(
        { success: false, message: "Session does not carry a hire reference" },
        { status: 401 }
      );
    }
    const result = (await dFetch(
      `/items/onboarding_profiles?filter[employee_id][_eq]=${employeeId}&fields=id,employee_id&limit=1`
    )) as { data?: { id: number; employee_id: number }[] };
    const row = Array.isArray(result?.data) ? result.data[0] : undefined;
    if (!row) {
      return NextResponse.json(
        { success: false, message: "No hire record found for this session" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      data: { profile_id: row.id, employee_id: row.employee_id },
    });
  } catch (error) {
    console.error("[onboarding-portal] session error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
