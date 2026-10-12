import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resignationApprovalService } from "@/modules/human-resource-management/resignation/resignation-approval/services/ResignationApprovalService";
import { ResignationReviewSchema } from "@/modules/human-resource-management/resignation/resignation-approval/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function reviewerIdFromPayload(payload: Record<string, unknown>): number | null {
    const raw = payload.id ?? payload.user_id ?? payload.sub;
    if (raw === undefined || raw === null) return null;
    const id = Number(raw);
    return Number.isNaN(id) ? null : id;
}

export async function GET() {
    try {
        const token = await getAuthToken();
        const payload = token ? decodeJwtPayload(token) : null;
        if (!payload) {
            return NextResponse.json(
                { error: "Unauthorized: No valid token" },
                { status: 401 }
            );
        }
        const pending = await resignationApprovalService.fetchPending();
        const data = pending.map((row) => ({
            ...row,
            view_file_url: row.attachment_uuid
                ? `/api/hrm/resignation/resignation-approval/${row.id}/file`
                : null,
        }));
        return NextResponse.json({
            data,
            total: data.length,
        });
    } catch (error) {
        console.error("GET resignation-approval error:", error);
        return NextResponse.json(
            { error: "Failed to fetch resignation requests" },
            { status: 500 }
        );
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const token = await getAuthToken();
        const payload = token ? decodeJwtPayload(token) : null;
        if (!payload) {
            return NextResponse.json(
                { error: "Unauthorized: No valid token" },
                { status: 401 }
            );
        }
        const reviewerId = reviewerIdFromPayload(payload);
        if (reviewerId === null) {
            return NextResponse.json(
                { error: "Unauthorized: No valid token" },
                { status: 401 }
            );
        }
        const body = await req.json();
        const parsed = ResignationReviewSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid request", details: parsed.error.flatten() },
                { status: 400 }
            );
        }
        await resignationApprovalService.review({
            id: parsed.data.id,
            status: parsed.data.status,
            remarks: parsed.data.remarks,
            reviewerId,
        });
        return NextResponse.json({
            success: true,
            message: `Resignation ${parsed.data.status} successfully`,
        });
    } catch (error) {
        console.error("PATCH resignation-approval error:", error);
        return NextResponse.json(
            { error: "Failed to update resignation request" },
            { status: 500 }
        );
    }
}
