import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import {
    MS_BULK_DRAIN_BATCH_SIZE,
    runBulkDrain,
} from "@/modules/human-resource-management/mailing-studio/studio-outbox/server/bulk-drain-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BODY_KEYS = ["limit"] as const;

function constantTimeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a, "utf8");
    const right = Buffer.from(b, "utf8");
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
}

function isTickAuthorized(req: NextRequest): boolean {
    const token = (process.env.MAIL_INTERNAL_EMIT_TOKEN ?? "").trim();
    if (token.length > 0) {
        const presented = (req.headers.get("x-internal-emit") ?? "").trim();
        if (presented.length === 0) return false;
        return constantTimeEqual(presented, token);
    }
    return req.headers.get("sec-fetch-mode") === null;
}

function rejectSuspiciousTickBody(body: unknown): Record<string, string[]> | null {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return { _body: ["Request body must be a JSON object"] };
    }
    const record = body as Record<string, unknown>;
    const errors: Record<string, string[]> = {};
    for (const key of Object.keys(record)) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
            errors[key] = [`Forbidden field: ${key}`];
            continue;
        }
        if (!(BODY_KEYS as readonly string[]).includes(key)) {
            errors[key] = [`Unknown field: ${key}`];
        }
    }
    if (record.limit !== undefined) {
        const limit = record.limit;
        if (
            typeof limit !== "number" ||
            !Number.isInteger(limit) ||
            limit < 1 ||
            limit > MS_BULK_DRAIN_BATCH_SIZE
        ) {
            errors.limit = [`Limit must be an integer from 1 to ${MS_BULK_DRAIN_BATCH_SIZE}`];
        }
    }
    return Object.keys(errors).length > 0 ? errors : null;
}

export async function POST(req: NextRequest) {
    try {
        if (!isTickAuthorized(req)) {
            return NextResponse.json({ success: false, message: "UNAUTHORIZED" }, { status: 401 });
        }
        let body: unknown = null;
        try {
            body = (await req.json()) as unknown;
        } catch {
            body = null;
        }
        let limit = MS_BULK_DRAIN_BATCH_SIZE;
        if (body !== null) {
            const suspicious = rejectSuspiciousTickBody(body);
            if (suspicious) {
                return NextResponse.json(
                    { success: false, message: "Validation failed", errors: suspicious },
                    { status: 400 }
                );
            }
            const record = body as Record<string, unknown>;
            if (typeof record.limit === "number") limit = record.limit;
        }
        const result = await runBulkDrain(limit, { publicBaseUrl: new URL(req.url).origin });
        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("[mailing-studio-outbox-tick] unexpected failure (never throw):", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
