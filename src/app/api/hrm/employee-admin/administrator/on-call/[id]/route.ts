import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { onCallService } from "@/modules/human-resource-management/employee-admin/administrator/on-call/services/on-call";
import { getManilaTimeISO } from "@/modules/human-resource-management/employee-admin/administrator/utils/utils";
import { OnCallScheduleSchema } from "@/modules/human-resource-management/employee-admin/administrator/on-call/types/on-call.schema";

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
    console.error("API Error:", error);
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
        const { id: idStr } = await params;
        const id = parseInt(idStr);
        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        const userId = payload?.id || payload?.user_id || payload?.sub;

        const body = await request.json();
        const { staffIds, ...scheduleData } = body;

        // Inject updated_at and encoder_id (as last editor)
        scheduleData.updated_at = getManilaTimeISO();
        if (userId) {
            scheduleData.encoder_id = typeof userId === "string" ? parseInt(userId) : userId;
        }

        // Validate partial data
        const validatedSchedule = OnCallScheduleSchema.partial().parse(scheduleData);

        await onCallService.updateSchedule(id, Object.assign({}, validatedSchedule), staffIds);
        return NextResponse.json({ success: true });
    } catch (error) {
        return handleApiError(error);
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idStr } = await params;
        const id = parseInt(idStr);
        await onCallService.deleteSchedule(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return handleApiError(error);
    }
}
