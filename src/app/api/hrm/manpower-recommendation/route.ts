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

function toStatusCode(message: string): number {
    if (message.startsWith("AUTH_DENIED")) return 401;
    if (message.startsWith("VALIDATION_FAILED")) return 400;
    return 500;
}

function toErrorCode(message: string): string {
    if (message.startsWith("AUTH_DENIED")) return "AUTH_DENIED";
    if (message.startsWith("VALIDATION_FAILED")) return "VALIDATION_FAILED";
    return "INTERNAL_FAIL";
}

function humanMessage(message: string): string {
    return message.replace(/^[A-Z_]+:\s*/, "");
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token: string | undefined = cookieStore.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        const raw = payload?.id || payload?.user_id || payload?.sub;
        const userId = typeof raw === "string" ? parseInt(raw) : raw;
        // Tightened 401: reference serves unauthenticated, this route requires a user.
        if (!userId) {
            return NextResponse.json({ error: "AUTH_DENIED" }, { status: 401 });
        }

        const [data, applicants, openRequests, users] = await Promise.all([
            manpowerRecommendationService.fetchAll(),
            manpowerRecommendationService.fetchApplicants(),
            manpowerRecommendationService.fetchOpenManpowerRequests(),
            manpowerRecommendationService.fetchUsers(),
        ]);

        return NextResponse.json({ data, applicants, openRequests, users });
    } catch (e: unknown) {
        const err = e as Error;
        if (err && typeof err === "object" && "issues" in err) {
            return NextResponse.json({ error: "VALIDATION_FAILED", message: err.message }, { status: 400 });
        }
        const message = err.message || "INTERNAL_FAIL";
        return NextResponse.json({ error: toErrorCode(message), message: humanMessage(message) }, { status: toStatusCode(message) });
    }
}

export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token: string | undefined = cookieStore.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        const raw = payload?.id || payload?.user_id || payload?.sub;
        const userId = typeof raw === "string" ? parseInt(raw) : raw;
        if (!userId) {
            return NextResponse.json({ error: "AUTH_DENIED" }, { status: 401 });
        }

        const body = await req.json();

        body.recommended_by = userId;
        body.recommended_at = nowPH();
        body.status = body.status || "Recommended";

        const validated = ManpowerRecommendationSchema.parse(body);

        // Approved guard: only recommendations against Approved requests are accepted.
        const { status, request_no } = await manpowerRecommendationService.fetchRequestStatus(validated.manpower_request_id);
        if (status !== 'Approved') {
            return NextResponse.json({ error: 'VALIDATION_FAILED', message: `Request ${request_no} is still pending approval. Recommendations open after approval.` }, { status: 400 });
        }

        // Capacity guard: block new recommendations once slots are filled.
        const capacity = await manpowerRecommendationService.fetchRequestCapacity(validated.manpower_request_id);
        if (capacity.need > 0 && capacity.active >= capacity.need) {
            return NextResponse.json({ error: 'VALIDATION_FAILED', message: `All ${capacity.need} slots for request ${capacity.request_no} are already filled.` }, { status: 400 });
        }

        const created = await manpowerRecommendationService.create(validated);
        return NextResponse.json({ data: created }, { status: 201 });
    } catch (e: unknown) {
        const err = e as Error;
        if (err && typeof err === "object" && "issues" in err) {
            return NextResponse.json({ error: "VALIDATION_FAILED", message: err.message }, { status: 400 });
        }
        const message = err.message || "INTERNAL_FAIL";
        return NextResponse.json({ error: toErrorCode(message), message: humanMessage(message) }, { status: toStatusCode(message) });
    }
}
