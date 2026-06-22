/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

export async function GET() {
    if (!DIRECTUS_URL) {
        return NextResponse.json({ error: "API base URL not configured" }, { status: 500 });
    }

    try {
        // Fetch users to populate dropdowns
        const res = await fetch(`${DIRECTUS_URL}/items/user?limit=5000&fields=user_id,user_fname,user_lname,user_position`, {
            headers: {
                "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
            }
        });
        
        if (!res.ok) {
            return NextResponse.json({ error: "Failed to fetch users" }, { status: res.status });
        }

        const data = await res.json();
        
        const mappedUsers = (data.data || []).map((u: any) => ({
            id: u.user_id,
            name: `${u.user_fname || ''} ${u.user_lname || ''}`.trim(),
            position: u.user_position || 'Unknown'
        }));

        return NextResponse.json({ data: mappedUsers });
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to fetch users", details: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
