import { NextResponse } from "next/server";

import { dFetch, directusMessage, isRecord } from "../_lib/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const body: unknown = await dFetch(
            "/items/company_list?fields=company_id,company_name,company_code&sort=company_name&limit=-1"
        );
        if (!isRecord(body) || !Array.isArray(body.data)) {
            return NextResponse.json(
                { message: directusMessage(body) ?? "Failed to list companies" },
                { status: 500 }
            );
        }
        return NextResponse.json({ data: body.data });
    } catch (error) {
        console.error("[id-layout-companies] GET error:", error);
        return NextResponse.json({ message: "Failed to list companies" }, { status: 500 });
    }
}
