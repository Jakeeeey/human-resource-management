import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/hrm/employee-admin/employee-master-list/employees
 * Fetches the active employee list from the Spring Boot backend.
 */
export async function GET(req: NextRequest) {
  try {
    const SPRING_URL = process.env.SPRING_API_BASE_URL;
    if (!SPRING_URL) {
      return NextResponse.json({ error: "Spring Boot API base not configured" }, { status: 500 });
    }

    const vosToken = req.cookies.get("vos_access_token")?.value;
    const { search } = new URL(req.url);
    const upstreamUrl = `${SPRING_URL.replace(/\/+$/, "")}/users${search}`;

    const res = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(vosToken ? { Authorization: `Bearer ${vosToken}` } : {}),
      },
      cache: "no-store",
    });

    const data = await res.arrayBuffer();
    return new NextResponse(data, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") || "application/json" },
    });
  } catch (error: unknown) {
    console.error("[Proxy Error] GET /employees:", error);
    return NextResponse.json({ error: "Proxy request failed" }, { status: 502 });
  }
}

/**
 * POST /api/hrm/employee-admin/employee-master-list/employees
 * Proxies creation to Spring Boot if needed (though /create is usually used)
 */
export async function POST() {
  // Implementation would be similar to /create/route.ts if needed
  return NextResponse.json({ error: "Use /create for POST requests" }, { status: 405 });
}
