import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "vos_access_token";

// Helper to decode JWT without verification (matching middleware logic)
function decodeJwt(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        let s = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        while (s.length % 4) s += "=";
        const json = Buffer.from(s, "base64").toString("utf8");
        return JSON.parse(json);
    } catch {
        return null;
    }
}

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
        return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const payload = decodeJwt(token);
    const userId = payload?.id || payload?.user_id || payload?.sub;

    if (!userId) {
        return NextResponse.json({ ok: false, message: "Invalid session" }, { status: 401 });
    }

    // Logic: Fetch fresh permissions from the Directus 'user_access' table
    const baseUrl = process.env.SPRING_API_BASE_URL; // Using established proxy pattern
    if (!baseUrl) {
        return NextResponse.json({ ok: false, message: "Server misconfigured" }, { status: 500 });
    }

    try {
        const filter = JSON.stringify({ user_id: { _eq: userId } });
        
        // Parallel fetch from both junction tables
        const [subRes, modRes] = await Promise.all([
            fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/items/user_access_subsystems?filter=${encodeURIComponent(filter)}&limit=-1&fields=subsystem_id.slug`, {
                headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` },
                next: { revalidate: 0 }
            }),
            fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/items/user_access_modules?filter=${encodeURIComponent(filter)}&limit=-1&fields=module_id.slug`, {
                headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` },
                next: { revalidate: 0 }
            })
        ]);

        if (!subRes.ok || !modRes.ok) {
            return NextResponse.json({ ok: false, message: "Failed to fetch permissions" }, { status: 500 });
        }

        const [subData, modData] = await Promise.all([subRes.json(), modRes.json()]);
        
        // Merge slugs from both tables
        const permissions = [
            ...(subData.data || []).map((row: any) => row.subsystem_id?.slug),
            ...(modData.data || []).map((row: any) => row.module_id?.slug)
        ].filter(Boolean);

        return NextResponse.json({
            ok: true,
            userId,
            email: payload?.email,
            permissions
        });
    } catch (error) {
        console.error("[UserProfileAPI] Error:", error);
        return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
    }
}
