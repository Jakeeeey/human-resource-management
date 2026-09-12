import { NextRequest, NextResponse } from "next/server";
import { logRedacted } from "@/modules/human-resource-management/recruitment/mailing/utils/mailLog";
import { ensureOnboardingProfile } from "./ensureOnboardingProfile";

export const runtime = "nodejs";

/**
 * POST /api/hrm/employee-admin/employee-master-list/create
 *
 * Proxies the employee creation payload to the Spring Boot backend.
 * Keeps credentials (SPRING_API_BASE_URL) server-side.
 */
export async function POST(req: NextRequest) {
  try {
    const SPRING_URL = process.env.SPRING_API_BASE_URL;

    if (!SPRING_URL) {
      return NextResponse.json(
        { error: "Spring Boot API base not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();
    console.log("[create employee payload]:", JSON.stringify(body, null, 2));

    const vosToken = req.cookies.get("vos_access_token")?.value;

    const upstreamUrl = `${SPRING_URL.replace(/\/+$/, "")}/users/create`;

    const response = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(vosToken ? { Authorization: `Bearer ${vosToken}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      // Onboarding hook (todo 2): idempotent ensure-call on Spring-create
      // success ONLY — void-style, never awaited, never alters this response.
      // The id resolves ONLY via the springProvider response shapes below;
      // any other shape is an explicit no-op with a redacted orphan alert.
      const record =
        data !== null && typeof data === "object" && !Array.isArray(data)
          ? (data as Record<string, unknown>)
          : null;
      const nested = (key: string): Record<string, unknown> | null => {
        const value = record?.[key];
        return value !== null && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : null;
      };
      const rawId =
        record?.["id"] ?? nested("data")?.["id"] ?? nested("user")?.["id"];
      const employeeId =
        typeof rawId === "number"
          ? rawId
          : Number.parseInt(String(rawId ?? ""), 10);
      if (!Number.isInteger(employeeId) || employeeId <= 0) {
        logRedacted(
          "[create employee] hire ok but employee id absent — onboarding ensure skipped"
        );
      } else {
        void ensureOnboardingProfile(employeeId).catch(logRedacted);
      }
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[create employee proxy]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
