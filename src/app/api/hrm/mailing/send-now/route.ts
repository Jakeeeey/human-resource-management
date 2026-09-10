import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dispatchMail } from "@/modules/human-resource-management/recruitment/mailing/utils/dispatchMail";
import { buildManualIdempotencyKey } from "@/modules/human-resource-management/recruitment/mailing/utils/idempotency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manual Send-now endpoint (mailing-module todo 12, Appendix Idempotency keys
// row). FROZEN to `final_interview.invited` — the event key is a const, never
// a request parameter, so this endpoint cannot be repurposed for auto events.
// One POST = ONE dispatchMail call with a fresh manual key
// `<event_key>:<application_id>:manual-<epochMs>` (built via
// buildManualIdempotencyKey — never rebuilt inline). There is deliberately NO
// count/bulk/ids parameter: `.strict()` rejects any such key with a 400.
//
// No auth gate (mailing-probe posture like the other mailing routes: the
// response carries only { ok, reason? } outcome booleans, never PII).

const MANUAL_EVENT_KEY = "final_interview.invited" as const;

const sendNowSchema = z
    .object({
        application_id: z.union([z.string().min(1), z.number()]),
        to_email: z.string().email().optional(),
    })
    .strict();

function validationFailed(errors: Record<string, string[]>) {
    return NextResponse.json(
        { success: false, message: "Validation failed", errors },
        { status: 400 }
    );
}

// POST /api/hrm/mailing/send-now — single manual invite dispatch.
// Body: `{ application_id, to_email? }`. Blank/absent to_email falls back to
// the application record's email inside dispatchMail (skipped row when
// unresolvable — never throws).
export async function POST(req: NextRequest) {
    try {
        const body: unknown = await req.json().catch(() => null);
        const validation = sendNowSchema.safeParse(body);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }

        const { application_id, to_email } = validation.data;
        const idempotencyKey = buildManualIdempotencyKey(
            MANUAL_EVENT_KEY,
            application_id,
            Date.now()
        );

        const result = await dispatchMail(MANUAL_EVENT_KEY, {
            event_key: MANUAL_EVENT_KEY,
            application_id,
            vars: {},
            ...(typeof to_email === "string" ? { to_email } : {}),
            idempotency_key: idempotencyKey,
        });

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("[mailing-send-now] send error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
