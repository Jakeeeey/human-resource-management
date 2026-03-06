import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const SPRING_URL = process.env.SPRING_API_BASE_URL;

    if (!SPRING_URL) {
      return NextResponse.json(
        { error: "Spring Boot API base not configured" },
        { status: 500 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams.id;
    const body = await req.json();

    const vosToken = req.cookies.get("vos_access_token")?.value;

    const upstreamUrl = `${SPRING_URL.replace(/\/+$/, "")}/users/${id}`;

    const response = await fetch(upstreamUrl, {
      method: "PUT",
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
    console.error(`[update employee proxy]`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
