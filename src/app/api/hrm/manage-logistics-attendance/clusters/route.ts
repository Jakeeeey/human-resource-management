/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

export async function GET() {
    if (!DIRECTUS_URL) {
        return NextResponse.json({ error: "API base URL not configured" }, { status: 500 });
    }

    try {
        const res = await fetch(`${DIRECTUS_URL}/items/cluster?limit=1000`, {
            headers: {
                "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
            }
        });
        
        if (!res.ok) {
            return NextResponse.json({ error: "Failed to fetch clusters" }, { status: res.status });
        }

        const data = await res.json();
        
        const mappedClusters = (data.data || []).map((c: any) => ({
            id: c.id,
            name: c.cluster_name
        }));

        return NextResponse.json({ data: mappedClusters });
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to fetch clusters", details: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
