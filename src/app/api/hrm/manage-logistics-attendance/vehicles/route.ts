/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

export async function GET() {
    try {
        if (!DIRECTUS_URL) {
            return NextResponse.json({ error: "API base URL not configured" }, { status: 500 });
        }

        const res = await fetch(`${DIRECTUS_URL}/items/vehicles?limit=500&fields=vehicle_id,vehicle_plate,vehicle_type.type_name`, {
            headers: {
                "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
            }
        });

        if (!res.ok) {
            return NextResponse.json({ error: "Failed to fetch vehicles" }, { status: res.status });
        }

        const data = (await res.json()).data || [];
        const mapped = data.map((v: any) => ({
            id: v.vehicle_id,
            plate: v.vehicle_plate,
            type: v.vehicle_type?.type_name || "Unknown",
        }));

        return NextResponse.json({ data: mapped });
    } catch (error) {
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
