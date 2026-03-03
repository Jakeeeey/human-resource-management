import { NextRequest, NextResponse } from "next/server";
import { directusFetch } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const body = await req.json();
    const payload = body?.data;

    if (!payload) {
      return NextResponse.json({ message: "Missing body.data" }, { status: 400 });
    }

    // Force inventory_day null (per requirement)
    payload.inventory_day = null;

    const r = await directusFetch(`/items/salesman/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    return NextResponse.json({ data: r?.data ?? r });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      { message: err.message ?? "Failed to update salesman." },
      { status: 500 },
    );
  }
}
