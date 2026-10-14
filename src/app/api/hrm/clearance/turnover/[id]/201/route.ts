import { NextRequest, NextResponse } from "next/server";

import { getTurnoverPdfFileId } from "@/modules/human-resource-management/clearance/hub/turnover/services/ClearanceTurnoverService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function toInlineFileName(fileId: string): string {
    const cleaned = fileId.replace(/[^\w.\-]/g, "_");
    if (cleaned === "") return "turnover-checklist-201.pdf";
    return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

async function resolvePdfFile(req: NextRequest, id: number): Promise<string | null> {
    const staged = req.nextUrl.searchParams.get("staged");
    if (staged !== null && staged.trim() !== "") return staged;
    const filed = await getTurnoverPdfFileId(id);
    if (filed === null || filed.trim() === "") return null;
    return filed;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageClearances");
        if ("failure" in auth) return auth.failure;
        const resolved = await params;
        const id = Number(resolved.id);
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        const pdfFile = await resolvePdfFile(req, id);
        if (pdfFile === null) {
            return NextResponse.json(
                { success: false, message: "No signed copy has been uploaded." },
                { status: 404 }
            );
        }
        if (!DIRECTUS_URL) {
            return NextResponse.json(
                { success: false, message: "Could not load the signed copy." },
                { status: 502 }
            );
        }
        const headers: Record<string, string> = {};
        if (DIRECTUS_STATIC_TOKEN) headers.Authorization = `Bearer ${DIRECTUS_STATIC_TOKEN}`;
        const upstream = await fetch(
            `${DIRECTUS_URL.replace(/\/+$/, "")}/assets/${pdfFile}`,
            { headers, cache: "no-store" }
        );
        if (!upstream.ok || !upstream.body) {
            return NextResponse.json(
                { success: false, message: "Could not load the signed copy." },
                { status: 502 }
            );
        }
        const contentType = upstream.headers.get("content-type") ?? "application/pdf";
        return new Response(upstream.body, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `inline; filename="${toInlineFileName(pdfFile)}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
