import { NextRequest, NextResponse } from "next/server";
import { directusFetch } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const r = await directusFetch(`/items/salesman?limit=-1&sort=-modified_date`);
    return NextResponse.json({ data: r?.data ?? [] });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      { message: err.message ?? "Failed to load salesmen." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const payload = body?.data;
    if (!payload) {
      return NextResponse.json({ message: "Missing body.data" }, { status: 400 });
    }

    // Force inventory_day null (per requirement)
    payload.inventory_day = null;

    const r = await directusFetch(`/items/salesman`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return NextResponse.json({ data: r?.data ?? r });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      { message: err.message ?? "Failed to create salesman." },
      { status: 500 },
    );
  }
}
