import { NextRequest, NextResponse } from "next/server";
import { directusFetch } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const id = ctx.params.id;

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
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Failed to update salesman." },
      { status: 500 },
    );
  }
}
