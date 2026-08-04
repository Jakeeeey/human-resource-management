import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { employeeConcernService } from "@/modules/human-resource-management/communications/employee-concerns/services/employee-concern";
import { EmployeeConcernStatusSchema } from "@/modules/human-resource-management/communications/employee-concerns/types/employee-concern.schema";

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
    console.error("Employee Concern [id] API Error:", error);
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
        if (Number.isNaN(id)) {
            return NextResponse.json({ error: "Invalid id" }, { status: 400 });
        }

        const body = await request.json();
        const validated = EmployeeConcernStatusSchema.parse(body);

        await employeeConcernService.updateStatus(id, validated.status);
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
        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        const role = payload?.role as string | undefined;
        const currentUserRole: "ADMIN" | "HR" | "USER" = role === "ADMIN" || role === "HR" ? role : "USER";

        // HR personnel cannot delete concerns — only ADMIN/USER may.
        if (currentUserRole === "HR") {
            return NextResponse.json(
                { error: "HR personnel cannot delete concerns." },
                { status: 403 }
            );
        }

        const { id: idStr } = await params;
        const id = parseInt(idStr);
        if (Number.isNaN(id)) {
            return NextResponse.json({ error: "Invalid id" }, { status: 400 });
        }

        await employeeConcernService.remove(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return handleApiError(error);
    }
}
