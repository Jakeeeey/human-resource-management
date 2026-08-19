import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { memoCreationService } from "@/modules/human-resource-management/memo-management/memo-creation/services/memo-creation.service";
import { MemoCreationFormSchema } from "@/modules/human-resource-management/memo-management/memo-creation/types/memo-creation.schema";

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
    console.error("Memo Creation API Error:", error);
    const status = errorInfo.message?.includes("VALIDATION_FAILED") ? 400 : 500;
    return NextResponse.json(
        { error: errorInfo.message || "Internal Server Error" },
        { status }
    );
}

export async function GET() {
    try {
        const data = await memoCreationService.fetchAll();
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
        
        // Zod Validation (ignores extra fields like created_at handled safely)
        const validatedForm = MemoCreationFormSchema.parse({
            subject: body.subject,
            attachment: body.attachment
        });

        // Generate Memo ID dynamically
        const nextSeq = await memoCreationService.getNextSequence();
        const dateObj = new Date();
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, "0");
        const date = String(dateObj.getDate()).padStart(2, "0");
        const datePrefix = `${year}${month}${date}`;
        const memo_id = `MM-${datePrefix}-${String(nextSeq).padStart(3, "0")}`;

        const record = {
            ...validatedForm,
            memo_id,
            created_at: body.created_at,
            created_by: userId ? (typeof userId === "string" ? parseInt(userId) || userId : userId) : null,
        };

        const created = await memoCreationService.create(record as Parameters<typeof memoCreationService.create>[0]);
        return NextResponse.json({ success: true, data: created }, { status: 201 });
    } catch (error) {
        return handleApiError(error);
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, subject, attachment } = body;

        if (!id) throw new Error("VALIDATION_FAILED: Missing ID");

        const validatedForm = MemoCreationFormSchema.parse({ subject, attachment });

        const updated = await memoCreationService.update(id, validatedForm);
        return NextResponse.json({ success: true, data: updated }, { status: 200 });
    } catch (error) {
        return handleApiError(error);
    }
}
