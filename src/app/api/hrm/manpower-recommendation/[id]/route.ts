import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { manpowerRecommendationService, nowPH } from "@/modules/human-resource-management/recruitment/manpower-recommendation/services/manpowerRecommendation.service";
import { ManpowerRecommendationSchema } from "@/modules/human-resource-management/recruitment/manpower-recommendation/types";

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

        const data = await manpowerRecommendationService.fetchById(id);
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

        // The client (Task 10 View) sends only { status, decision_notes } — it has no
        // userId in scope. NEVER trust client-supplied decision_by/decision_at;
        // always overwrite server-side on status transitions.
        if (body.status) {
            body.decision_by = userId;
            body.decision_at = nowPH();
        }

        const validated = ManpowerRecommendationSchema.omit({ id: true }).partial().parse(body);

        // Slot guard: moving a recommendation INTO Approved/Hired must not exceed capacity.
        if (validated.status === 'Approved' || validated.status === 'Hired') {
            const current = await manpowerRecommendationService.fetchById(id);
            const wasActive = current?.status === 'Approved' || current?.status === 'Hired';
            if (current && !wasActive) {
                const capacity = await manpowerRecommendationService.fetchRequestCapacity(current.manpower_request_id);
                if (capacity.need > 0 && capacity.active >= capacity.need) {
                    return NextResponse.json({ error: 'VALIDATION_FAILED', message: `Cannot approve — all ${capacity.need} slots for request ${capacity.request_no} are already filled.` }, { status: 400 });
                }
            }
        }

        const data = await manpowerRecommendationService.update(id, validated);
        return NextResponse.json({ data });
    } catch (e: unknown) {
        console.error("Error in PATCH /api/hrm/manpower-recommendation/[id]:", e);
        const rawMessage = (e as Error).message || "INTERNAL_FAIL";
        return NextResponse.json({ error: rawMessage, message: rawMessage.replace(/^[A-Z_]+:\s*/, "") }, { status: 400 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const id = parseInt(resolvedParams.id, 10);
        if (isNaN(id)) return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });

        await manpowerRecommendationService.remove(id);
        return NextResponse.json({ success: true });
    } catch (e: unknown) {
        console.error("Error in DELETE /api/hrm/manpower-recommendation/[id]:", e);
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
