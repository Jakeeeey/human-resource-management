import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { companyMemoService } from "@/modules/human-resource-management/communications/company-memo/services/company-memo.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

function handleApiError(error: unknown) {
    const errorInfo = error as { message?: string };
    console.error("Company Memo API Error:", error);
    const status = errorInfo.message?.includes("VALIDATION_FAILED") ? 400 : 500;
    return NextResponse.json(
        { error: errorInfo.message || "Internal Server Error" },
        { status }
    );
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const idParam = (await params).id;
        const id = parseInt(idParam, 10);
        if (isNaN(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        const userId = payload?.id || payload?.user_id || payload?.sub;
        const parsedUserId = userId ? (typeof userId === "string" ? parseInt(userId) : userId) : null;

        const body = await request.json();

        const updateData = {
            ...body,
            updated_by: parsedUserId,
        };

        const updated = await companyMemoService.update(id, updateData);
        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        return handleApiError(error);
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const idParam = (await params).id;
        const id = parseInt(idParam, 10);
        if (isNaN(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        await companyMemoService.remove(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return handleApiError(error);
    }
}
