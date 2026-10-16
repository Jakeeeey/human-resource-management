import { NextRequest, NextResponse } from "next/server";

import { getQuitClaimPdfFileId } from "@/modules/human-resource-management/clearance/hub/quit-claims/services/ClearanceQuitClaimService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageClearances");
        if ("failure" in auth) return auth.failure;
        const resolved = await params;
        const id = Number(resolved.id);
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        const staged = req.nextUrl.searchParams.get("staged");
        const pdfFileId =
            staged !== null && staged !== "" ? staged : await getQuitClaimPdfFileId(id);
        if (pdfFileId === null || pdfFileId === "") {
            return NextResponse.json(
                { success: false, message: "No signed copy has been uploaded." },
                { status: 404 }
            );
        }
        const base = process.env.NEXT_PUBLIC_API_BASE_URL;
        const token = process.env.DIRECTUS_STATIC_TOKEN;
        const headers: Record<string, string> =
            token && token.trim() !== "" ? { Authorization: `Bearer ${token}` } : {};
        const upstream = await fetch(`${base}/assets/${pdfFileId}`, { headers, cache: "no-store" });
        if (!upstream.ok || !upstream.body) {
            return NextResponse.json(
                { success: false, message: "Could not load the signed copy." },
                { status: 502 }
            );
        }
        const contentType = upstream.headers.get("content-type") ?? "application/pdf";
        const fileName = `Quit Claim - ${id}.pdf`;
        return new Response(upstream.body, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `inline; filename="${fileName}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
