import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";
import { dFetch, DIRECTUS_URL } from "@/modules/human-resource-management/shared/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/company-logos
//
// Read-only list for the Job Offer Company picker: every company_list row
// with its logo bytes inlined as a data URL (same pattern as the by-applicant
// bundle — the browser can't call /assets with the server static token).
// Logos live in company_list.company_logo (file UUID), selected from the
// Directus `company_logos` files folder. No company_logo table exists.
// Server-side only — DIRECTUS_STATIC_TOKEN never reaches the browser.

interface RawCompanyRow {
    company_id: number;
    company_code: string;
    company_name: string;
    company_city: string | null;
    company_logo: string | null;
    is_default: boolean | number | null;
}

async function fetchAssetDataUrl(logoFile: unknown): Promise<string | null> {
    if (typeof logoFile !== "string" || !logoFile) return null;
    // company_list.company_logo stores a bare file UUID (not an /assets path
    // like the by-applicant attachments), so accept both shapes here.
    const match = logoFile.match(/\/?assets\/([a-f0-9-]+)/i);
    const bareUuid = /^[a-f0-9-]{36}$/i.test(logoFile.trim()) ? logoFile.trim() : null;
    const fileId = match ? match[1] : bareUuid;
    if (!fileId) return null;
    const res = await fetch(`${DIRECTUS_URL}/assets/${fileId}`, {
        headers: { Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` },
    });
    if (!res.ok) return null;
    const mime = res.headers.get("content-type") ?? "image/png";
    const bytes = Buffer.from(await res.arrayBuffer()).toString("base64");
    return `data:${mime};base64,${bytes}`;
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token: string | undefined = cookieStore.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        const raw = payload?.id || payload?.user_id || payload?.sub;
        const userId = typeof raw === "string" ? parseInt(raw, 10) : raw;
        if (!userId) {
            return NextResponse.json({ error: "AUTH_DENIED" }, { status: 401 });
        }

        // company_city rides along so the letter's Based-in line auto-fills
        // from the picked company. It may not exist on older company_list
        // schemas — Directus answers unknown fields with 400 (surfaced by
        // dFetch as a body without `data`), so retry without it and let the
        // picker work with name+logo only instead of breaking the list.
        const withCity = (await dFetch(
            `/items/company_list?fields=company_id,company_code,company_name,company_city,company_logo,is_default&sort=company_code&limit=-1`
        )) as { data?: RawCompanyRow[] };
        let rows = Array.isArray(withCity?.data) ? withCity.data : null;
        if (!rows) {
            const base = (await dFetch(
                `/items/company_list?fields=company_id,company_code,company_name,company_logo,is_default&sort=company_code&limit=-1`
            )) as { data?: RawCompanyRow[] };
            rows = base?.data ?? [];
        }

        const data = await Promise.all(
            rows.map(async (row) => ({
                id: row.company_id,
                company_code: row.company_code,
                company_name: row.company_name,
                company_city: row.company_city ?? null,
                logo_data_url: await fetchAssetDataUrl(row.company_logo),
                is_default: Boolean(row.is_default),
            }))
        );

        return NextResponse.json({ data });
    } catch (error) {
        console.error("[company-logos] error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
