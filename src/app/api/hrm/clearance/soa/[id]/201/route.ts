import { NextRequest, NextResponse } from "next/server";

import { dFetch } from "@/modules/human-resource-management/clearance/hub/utils/directus";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function readPdfFile(body: unknown): string | null {
    if (!isRecord(body) || !isRecord(body.data)) return null;
    const value = (body.data as { pdf_file?: unknown }).pdf_file;
    return typeof value === "string" && value !== "" ? value : null;
}

function notFound(): NextResponse {
    return NextResponse.json(
        { success: false, message: "No signed copy has been uploaded." },
        { status: 404 }
    );
}

function upstreamFailed(): NextResponse {
    return NextResponse.json(
        { success: false, message: "Could not load the signed copy." },
        { status: 502 }
    );
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
        const staged = req.nextUrl.searchParams.get("staged");
        let pdfFile: string | null = staged !== null && staged.trim() !== "" ? staged : null;
        if (pdfFile === null) {
            try {
                pdfFile = readPdfFile(
                    await dFetch(`/items/clearance_soa/${id}?fields=pdf_file`, { cache: "no-store" })
                );
            } catch {
                pdfFile = null;
            }
        }
        if (pdfFile === null) return notFound();
        const base = process.env.NEXT_PUBLIC_API_BASE_URL;
        if (!base || base.trim() === "") return upstreamFailed();
        const token = process.env.DIRECTUS_STATIC_TOKEN;
        const headers: Record<string, string> =
            token && token.trim() !== "" ? { Authorization: `Bearer ${token}` } : {};
        const upstream = await fetch(
            `${base.replace(/\/+$/, "")}/assets/${encodeURIComponent(pdfFile)}`,
            { headers, cache: "no-store" }
        );
        if (!upstream.ok || upstream.body === null) return upstreamFailed();
        return new NextResponse(upstream.body, {
            status: 200,
            headers: {
                "Content-Type": upstream.headers.get("content-type") ?? "application/pdf",
                "Content-Disposition": 'inline; filename="signed-copy.pdf"',
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
