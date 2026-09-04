import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { interviewService } from "@/modules/human-resource-management/recruitment/interviews/services/interview.service";
import { InterviewSchema } from "@/modules/human-resource-management/recruitment/interviews/types";

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        const raw = payload?.id || payload?.user_id || payload?.sub;
        const userId = typeof raw === "string" ? parseInt(raw, 10) : raw;
        if (!userId) return NextResponse.json({ error: "AUTH_DENIED" }, { status: 401 });

        const resolvedParams = await params;
        const id = parseInt(resolvedParams.id, 10);
        if (isNaN(id)) return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });

        const list = await interviewService.fetchInterviews();
        const data = list.interviews.find((i) => i.id === id) ?? null;
        if (!data) return NextResponse.json({ error: "DB_NOT_FOUND" }, { status: 404 });

        return NextResponse.json({ data });
    } catch (e: unknown) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const id = parseInt(resolvedParams.id, 10);
        if (isNaN(id)) return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });

        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        const raw = payload?.id || payload?.user_id || payload?.sub;
        const userId = typeof raw === "string" ? parseInt(raw, 10) : raw;
        if (!userId) return NextResponse.json({ error: "AUTH_DENIED" }, { status: 401 });

        const body = await req.json();

        body.updated_by = userId;

        // The client sends only { verdict, notes, interviewed_by } — it has no
        // userId in scope. NEVER trust client-supplied updated_by; always
        // overwrite server-side. updated_at is stamped by the service via nowPH().
        const validated = InterviewSchema.omit({ id: true }).partial().parse(body);

        const data = await interviewService.updateInterview(id, validated);
        return NextResponse.json({ data });
    } catch (e: unknown) {
        console.error("Error in PATCH /api/hrm/interviews/[id]:", e);
        const rawMessage = (e as Error).message || "INTERNAL_FAIL";
        return NextResponse.json({ error: rawMessage, message: rawMessage.replace(/^[A-Z_]+:\s*/, "") }, { status: 400 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        const raw = payload?.id || payload?.user_id || payload?.sub;
        const userId = typeof raw === "string" ? parseInt(raw, 10) : raw;
        if (!userId) return NextResponse.json({ error: "AUTH_DENIED" }, { status: 401 });

        const resolvedParams = await params;
        const id = parseInt(resolvedParams.id, 10);
        if (isNaN(id)) return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });

        await interviewService.removeInterview(id);
        return NextResponse.json({ success: true });
    } catch (e: unknown) {
        console.error("Error in DELETE /api/hrm/interviews/[id]:", e);
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
