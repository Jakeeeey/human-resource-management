import { NextRequest, NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export const dynamic = "force-dynamic";

async function directusFetch(path: string, options: RequestInit = {}) {
  const token = process.env.DIRECTUS_STATIC_TOKEN || "";
  const response = await fetch(`${DIRECTUS_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Directus API error: ${response.status} - ${error}`);
  }
  return response.json();
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ coeId: string }> },
) {
  try {
    const { coeId } = await params;
    const id = parseInt(coeId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid COE id" }, { status: 400 });
    }

    const body = await req.json();
    const { ecopy_file_url } = body;

    if (!ecopy_file_url) {
      return NextResponse.json(
        { error: "ecopy_file_url is required" },
        { status: 400 },
      );
    }

    await directusFetch(`/items/coe_requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ ecopy_file_url }),
    });

    return NextResponse.json({
      success: true,
      message: "E-copy attached successfully",
    });
  } catch (error) {
    console.error("[COE ecopy attach] error:", error);
    return NextResponse.json(
      { error: "Failed to attach e-copy" },
      { status: 500 },
    );
  }
}
