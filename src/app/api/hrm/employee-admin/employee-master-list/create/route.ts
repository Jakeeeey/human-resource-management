import { NextRequest, NextResponse } from "next/server";

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

    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[create employee proxy]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
