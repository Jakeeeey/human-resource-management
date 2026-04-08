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

    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!baseUrl) {
        console.error("[Sidebar - User Profile Proxy] NEXT_PUBLIC_API_BASE_URL missing.");
        return NextResponse.json({ ok: false, message: "Server misconfigured" }, { status: 500 });
    }

    try {
        // Parallel fetch from junction tables + custom user collection
        const [subRes, modRes, userRes] = await Promise.all([
            fetch(`${baseUrl}/items/user_access_subsystems?filter=${encodeURIComponent(JSON.stringify({ user_id: { _eq: userId } }))}&limit=-1&fields=subsystem_id.id,subsystem_id.slug`, {
                headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` },
                next: { revalidate: 0 }
            }),
            fetch(`${baseUrl}/items/user_access_modules?filter=${encodeURIComponent(JSON.stringify({ user_id: { _eq: userId } }))}&limit=-1&fields=module_id.id,module_id.slug`, {
                headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` },
                next: { revalidate: 0 }
            }),
            fetch(`${baseUrl}/items/user/${userId}?fields=role,isAdmin`, {
                headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` },
                next: { revalidate: 0 }
            })
        ]);

        if (!subRes.ok || !modRes.ok) {
            console.error(`[Sidebar - User Profile Proxy] Permission Fetch Failed: Subs=${subRes.status}, Mods=${modRes.status}`);
            return NextResponse.json({ ok: false, message: "Failed to fetch permissions" }, { status: 500 });
        }

        const [subData, modData, userData] = await Promise.all([subRes.json(), modRes.json(), userRes.json()]);
        
        const u = userData?.data || {};
        const isAdmin = u.role === "ADMIN" || u.isAdmin === 1 || u.isAdmin === true;
        
        console.log(`[Sidebar - User Profile Proxy] Fetching for User: ${userId}. role: ${u.role}, isAdmin_field: ${u.isAdmin}, RESOLVED_isAdmin: ${isAdmin}`);

        const subsystemIds = (subData.data || [])
            .map((row: { subsystem_id?: { id?: number | string } }) => Number(row.subsystem_id?.id))
            .filter((id: number) => !isNaN(id));

        const moduleIds = (modData.data || [])
            .map((row: { module_id?: { id?: number | string } }) => Number(row.module_id?.id))
            .filter((id: number) => !isNaN(id));

        const permissions = [
            ...(subData.data || []).map((row: { subsystem_id?: { slug?: string } }) => row.subsystem_id?.slug),
            ...(modData.data || []).map((row: { module_id?: { slug?: string } }) => row.module_id?.slug)
        ].filter(Boolean) as string[];

        return NextResponse.json({
            ok: true,
            userId,
            isAdmin,
            subsystemIds: isAdmin ? ["*"] : subsystemIds,
            moduleIds: isAdmin ? ["*"] : moduleIds,
            permissions: isAdmin ? ["*"] : permissions
        });
    } catch (error) {
        console.error("[Sidebar - User Profile Proxy] Fatal Error:", error);
        return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
    }
}
