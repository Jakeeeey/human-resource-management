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

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const departmentName = searchParams.get("department") || undefined;

        const data = await onCallService.fetchAllSchedules({
            department_name: departmentName,
        });
        return NextResponse.json({ data });
    } catch (error) {
        return handleApiError(error);
    }
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        const userId = payload?.id || payload?.user_id || payload?.sub;

        const body = await request.json();
        const { staffIds, ...scheduleData } = body;

        // Inject created_at, updated_at and encoder_id if available
        const now = getManilaTimeISO();
        scheduleData.created_at = now;
        scheduleData.updated_at = now;
        scheduleData.grace_period = body.grace_period;

        if (userId) {
            scheduleData.encoder_id = typeof userId === "string" ? parseInt(userId) : userId;
        }

        // Validate schedule data
        const validatedSchedule = OnCallScheduleSchema.parse(scheduleData);

        await onCallService.createSchedule(Object.assign({}, validatedSchedule), staffIds);
        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
        return handleApiError(error);
    }
}
