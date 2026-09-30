import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resignationApprovalService } from "@/modules/human-resource-management/resignation/resignation-approval/services/ResignationApprovalService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const COOKIE_NAME = "vos_access_token";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        if (!token) return null;
        const parts = token.split(".");
        if (parts.length < 2) return null;
        const p = parts[1];
        const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
        const json = Buffer.from(padded, "base64").toString("utf8");
        return JSON.parse(json);
    } catch {
        return null;
    }
}

async function getAuthToken(): Promise<string | null> {
    const cookieStore = await cookies();
    return cookieStore.get(COOKIE_NAME)?.value || null;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const token = await getAuthToken();
        const payload = token ? decodeJwtPayload(token) : null;
        if (!payload) {
            return NextResponse.json(
                { error: "Unauthorized: No valid token" },
                { status: 401 }
            );
        }
        const { id } = await params;
        const recordId = Number(id);
        if (Number.isNaN(recordId)) {
            return NextResponse.json({ error: "Invalid resignation id" }, { status: 400 });
        }
        const attachment = await resignationApprovalService.fetchAttachmentFileId(recordId);
        if (!attachment) {
            return NextResponse.json({ error: "No file attached" }, { status: 404 });
        }
        const staticToken = process.env.DIRECTUS_STATIC_TOKEN || "";
        const upstream = await fetch(`${DIRECTUS_URL}/assets/${attachment.fileId}`, {
            headers: { Authorization: `Bearer ${staticToken}` },
        });
        if (!upstream.ok || !upstream.body) {
            return NextResponse.json(
                { error: "Failed to retrieve file from storage" },
                { status: 502 }
            );
        }
        const filename = attachment.fileName || `Resignation-${id}.pdf`;
        const contentType = attachment.fileType || "application/pdf";
        const dispositionParam = req.nextUrl.searchParams.get("download");
        const disposition = dispositionParam === "1" ? "attachment" : "inline";
        return new Response(upstream.body, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`,
                "Cache-Control": "private, no-store",
            },
        });
    } catch (error) {
        console.error("[Resignation file stream] error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
