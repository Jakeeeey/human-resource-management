import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { companyMemoService } from "@/modules/human-resource-management/communications/company-memo/services/company-memo.service";
import {
    CompanyMemoFormSchema,
    CompanyMemoSchema,
    type CompanyMemoStatus,
    type CompanyMemoPriority,
} from "@/modules/human-resource-management/communications/company-memo/types/company-memo.schema";

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

export async function GET() {
    try {
        const data = await companyMemoService.fetchAll();
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

        // Validate the incoming fields
        const validatedForm = CompanyMemoFormSchema.parse(body);

        // Inject server-only fields
        const record = {
            ...validatedForm,
            status: validatedForm.status as CompanyMemoStatus,
            priority: validatedForm.priority as CompanyMemoPriority,
            created_by: userId ? (typeof userId === "string" ? parseInt(userId) : userId) : null,
        };

        const validated = CompanyMemoSchema.parse(record);
        const created = await companyMemoService.create(validated);
        return NextResponse.json({ success: true, data: created }, { status: 201 });
    } catch (error) {
        return handleApiError(error);
    }
}
