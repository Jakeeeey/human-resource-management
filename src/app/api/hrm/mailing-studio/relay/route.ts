import { NextRequest, NextResponse } from "next/server";

import {
    MS_RELAY_BATCH_SIZE,
    runRelaySweep,
} from "@/modules/human-resource-management/mailing-studio/services/relay-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Relay trigger route (P5-T2, §5 RELAY block) —
// `POST /api/hrm/mailing-studio/relay` runs one bounded retry sweep and
// answers `{ success: true, data: { processed, sent, failed } }`.
//
// No scheduler is required for correctness (every emit also sweeps, P5-T3);
// this route exists so a Directus *schedule* flow can invoke it with a
// `Request URL` operation (P5-T4, script-free per the standing invariant).
// The sweep itself is idempotent and bounded (50 rows), so the route takes
// no authentication — a repeated call merely re-drives due rows, and the
// conditional claim keeps concurrent sweepers from double-processing.
//
// The route NEVER throws: every failure — including Directus outages and
// unexpected exceptions — is a JSON envelope. An optional body
// `{ "limit": n }` (integer, 1..50, default 50) bounds the batch.

const BODY_KEYS = ["limit"] as const;

function rejectSuspiciousRelayBody(body: unknown): Record<string, string[]> | null {
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
            limit > MS_RELAY_BATCH_SIZE
        ) {
            errors.limit = [`Limit must be an integer from 1 to ${MS_RELAY_BATCH_SIZE}`];
        }
    }
    return Object.keys(errors).length > 0 ? errors : null;
}

// POST /api/hrm/mailing-studio/relay — `{ "limit"?: n }`.
export async function POST(req: NextRequest) {
    try {
        let body: unknown = null;
        try {
            body = (await req.json()) as unknown;
        } catch {
            body = null;
        }

        let limit = MS_RELAY_BATCH_SIZE;
        if (body !== null) {
            const suspicious = rejectSuspiciousRelayBody(body);
            if (suspicious) {
                return NextResponse.json(
                    { success: false, message: "Validation failed", errors: suspicious },
                    { status: 400 },
                );
            }
            const record = body as Record<string, unknown>;
            if (typeof record.limit === "number") limit = record.limit;
        }

        const result = await runRelaySweep(limit);
        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("[mailing-studio-relay] unexpected failure (never throw):", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 },
        );
    }
}
