import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { interviewService, nowPH, maybeAutoApproveRecommendation } from "@/modules/human-resource-management/recruitment/interviews/services/interview.service";
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

        // Passed verdicts are final: once set, the verdict cannot be changed.
        const existing = (await interviewService.fetchInterviews()).interviews.find((i) => i.id === id) ?? null;
        if (existing?.verdict === "Passed" && typeof body.verdict === "string" && body.verdict !== "Passed") {
            return NextResponse.json({ error: "VALIDATION_FAILED", message: "This interview already has a Passed verdict and can no longer be changed." }, { status: 400 });
        }

        // Grade path for a scheduled row: items present means the grade page
        // is submitting criteria scores, so the server creates the sheet +
        // items + composite first, then links them onto the interview row with
        // the manual verdict and interviewer stamps.
        if (Array.isArray(body.items) && body.items.length > 0) {
            const stage = body.stage === "Final" ? "Final" : "Initial";
            const template_id = body.template_id;
            if (typeof template_id !== "number" || typeof body.application_id !== "number") {
                return NextResponse.json({ error: "VALIDATION_FAILED", message: "A scoring template and application are required to submit interview grading." }, { status: 400 });
            }
            const verdict = body.verdict === "Passed" || body.verdict === "Failed" ? body.verdict : "Pending";
            const data = await interviewService.gradeScheduledInterview(id, {
                stage,
                application_id: body.application_id,
                template_id,
                verdict,
                interviewed_by: typeof userId === "number" ? userId : null,
                interviewed_at: typeof body.interviewed_at === "string" && body.interviewed_at ? body.interviewed_at : nowPH(),
                notes: typeof body.notes === "string" && body.notes ? body.notes : null,
                items: body.items,
            });
            const autoApproved =
                data.stage === "Final" && data.verdict === "Passed"
                    ? await maybeAutoApproveRecommendation(data.recommendation_id)
                    : false;
            return NextResponse.json({ data, autoApproved });
        }

        // The client sends only { verdict, notes, interviewed_by } — it has no
        // userId in scope. NEVER trust client-supplied updated_by; always
        // overwrite server-side. updated_at is stamped by the service via nowPH().
        const validated = InterviewSchema.omit({ id: true }).partial().parse(body);

        const data = await interviewService.updateInterview(id, validated);
        const autoApproved =
            data.stage === "Final" && data.verdict === "Passed" && existing?.verdict !== "Passed"
                ? await maybeAutoApproveRecommendation(data.recommendation_id)
                : false;
        return NextResponse.json({ data, autoApproved });
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
