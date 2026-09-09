import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { manpowerRecommendationService, nowPH } from "@/modules/human-resource-management/recruitment/manpower-recommendation/services/manpowerRecommendation.service";
import { interviewService } from "@/modules/human-resource-management/recruitment/interviews/services/interview.service";
import { ManpowerRecommendationSchema } from "@/modules/human-resource-management/recruitment/manpower-recommendation/types";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";
const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

async function dFetch(path: string, options?: RequestInit) {
    const res = await fetch(`${DIRECTUS_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${STATIC_TOKEN}`,
            ...(options?.headers || {}),
        },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
    }
    if (res.status === 204) return null;
    return res.json();
}

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

        const [data, applicants, openRequests, divisions, users] = await Promise.all([
            manpowerRecommendationService.fetchAll(),
            manpowerRecommendationService.fetchApplicants(),
            manpowerRecommendationService.fetchOpenManpowerRequests(),
            manpowerRecommendationService.fetchDivisions(),
            manpowerRecommendationService.fetchUsers(),
        ]);

        return NextResponse.json({ data, applicants, openRequests, divisions, users });
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

        const created = await manpowerRecommendationService.create(validated);
        try {
            const existingRes = await dFetch(
                `/items/interview?filter[recommendation_id][_eq]=${created.id}&filter[stage][_eq]=Final&filter[score_sheet_id][_null]=true&limit=1&fields=id`
            );
            const hasUngraded = Array.isArray(existingRes?.data) && existingRes.data.length > 0;
            if (!hasUngraded && created.applicant_id != null) {
                const appRes = await dFetch(
                    `/items/application?filter[applicant_id][_eq]=${created.applicant_id}&fields=id&sort=-id&limit=1`
                );
                const applicationId = Array.isArray(appRes?.data) && appRes.data.length > 0 ? appRes.data[0].id as number : null;
                if (typeof applicationId === "number") {
                    await interviewService.createScheduledInterview({
                        stage: "Final",
                        application_id: applicationId,
                        manpower_request_id: created.manpower_request_id ?? null,
                        recommendation_id: created.id ?? null,
                    });
                }
            }
        } catch (materializeErr) {
            console.error(
                "[manpower-recommendation] pending Final materialize failed for recommendation_id",
                created.id,
                materializeErr
            );
        }
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
