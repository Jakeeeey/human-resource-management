import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { employeeConcernService } from "@/modules/human-resource-management/communications/employee-concerns/services/employee-concern";
import {
    EmployeeConcernFormSchema,
    EmployeeConcernSchema,
    type ConcernStatus,
} from "@/modules/human-resource-management/communications/employee-concerns/types/employee-concern.schema";

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
    console.error("Employee Concern API Error:", error);
    const status = errorInfo.message?.includes("VALIDATION_FAILED") ? 400 : 500;
    return NextResponse.json(
        { error: errorInfo.message || "Internal Server Error" },
        { status }
    );
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status") as ConcernStatus | null;

        const data = await employeeConcernService.fetchAll(status ?? undefined);
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

        // Validate the employee-submitted form fields.
        const validatedForm = EmployeeConcernFormSchema.parse(body);

        // Inject server-only fields: the logged-in employee is both the
        // subject (user_id) and the encoder (created_by). Status defaults to
        // PENDING on creation; created_at is set by Directus/DB default.
        const record = {
            ...validatedForm,
            status: "PENDING" as ConcernStatus,
            user_id: userId ? (typeof userId === "string" ? parseInt(userId) : userId) : null,
            created_by: userId ? (typeof userId === "string" ? parseInt(userId) : userId) : null,
        };

        const validated = EmployeeConcernSchema.parse(record);
        const created = await employeeConcernService.create(validated);
        return NextResponse.json({ success: true, data: created }, { status: 201 });
    } catch (error) {
        return handleApiError(error);
    }
}
