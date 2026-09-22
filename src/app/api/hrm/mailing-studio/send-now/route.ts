import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dispatchMail } from "@/modules/human-resource-management/mailing-studio/services/dispatch-service";
import { msEventKeySchema } from "@/modules/human-resource-management/mailing-studio/types/ms-template.schema";
import { buildManualIdempotencyKey } from "@/modules/human-resource-management/mailing-studio/utils/ms-idempotency";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manual Send-now endpoint (T4) — binding-triggered dispatch through
// services/dispatch-service. STRICT body: `{ event_key | binding_id, to_email }`
// (`.strict()` + exactly-one-of: no count/bulk/ids/application parameters are
// accepted — any extra key answers 400). `event_key` is restricted to the
// frozen msEventKeySchema; `binding_id` resolves an ms_bindings row first
// (missing → 404, disabled → 400) and dispatches its frozen event.
//
// One POST = ONE dispatchMail call with a FRESH manual idempotency key
// `<event_key>:<ref>:manual-<epochMs>` (built via buildManualIdempotencyKey —
// never rebuilt inline), so every click dispatches (never deduped). The
// recipient comes from the body's to_email (single `to`, no CC/BCC anywhere).
// Envelope { success, data?, message?, errors? }; data carries the
// dispatch-service { ok, reason? } outcome — never PII.

interface BindingLookupRow {
    id?: unknown;
    event_key?: unknown;
    is_enabled?: unknown;
}

function toBool(value: unknown): boolean {
    return value === true || value === 1 || value === "1" || value === "true";
}

function validationFailed(errors: Record<string, string[]>) {
    return NextResponse.json(
        { success: false, message: "Validation failed", errors },
        { status: 400 }
    );
}

const sendNowSchema = z
    .object({
        event_key: msEventKeySchema.optional(),
        binding_id: z.union([z.string().min(1), z.number()]).optional(),
        to_email: z.string().email("Recipient email must be valid"),
    })
    .strict()
    .superRefine((value, ctx) => {
        const hasEventKey = value.event_key !== undefined;
        const hasBindingId = value.binding_id !== undefined;
        if (hasEventKey === hasBindingId) {
            ctx.addIssue({
                code: "custom",
                message: "Provide exactly one of event_key or binding_id",
                path: [hasBindingId ? "binding_id" : "event_key"],
            });
        }
    });

// POST /api/hrm/mailing-studio/send-now — single binding-triggered dispatch.
// Body: `{ event_key | binding_id, to_email }`.
export async function POST(req: NextRequest) {
    try {
        const body: unknown = await req.json().catch(() => null);
        const validation = sendNowSchema.safeParse(body);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }

        const { to_email } = validation.data;
        let eventKey: string;
        let ref: string;

        if (validation.data.binding_id !== undefined) {
            const bindingId = validation.data.binding_id;
            ref = String(bindingId);
            // Filter-based lookup (never /items/:id) — a missing row is an
            // empty list, dodging the Directus missing-single-item 403 gotcha.
            const res = (await dFetch(
                `/items/ms_bindings?filter[id][_eq]=${encodeURIComponent(ref)}` +
                    "&fields=id,event_key,template_id,is_enabled,send_condition&limit=1"
            )) as { data?: BindingLookupRow[]; errors?: { message?: string }[] };
            const row = Array.isArray(res?.data) ? res.data[0] : undefined;
            if (!row) {
                const message = res?.errors?.[0]?.message ?? "Binding not found.";
                return NextResponse.json({ success: false, message }, { status: 404 });
            }
            if (!toBool(row.is_enabled)) {
                return NextResponse.json(
                    { success: false, message: "Binding is disabled." },
                    { status: 400 }
                );
            }
            const keyCheck = msEventKeySchema.safeParse(row.event_key);
            if (!keyCheck.success) {
                return validationFailed({ event_key: ["Unknown event key"] });
            }
            eventKey = keyCheck.data;
        } else {
            eventKey = validation.data.event_key as string;
            ref = eventKey;
        }

        const idempotencyKey = buildManualIdempotencyKey(eventKey, ref, Date.now());

        const result = await dispatchMail(eventKey, {
            event_key: eventKey,
            application_id: ref,
            vars: {},
            to_email,
            idempotency_key: idempotencyKey,
        });

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("[mailing-studio-send-now] send error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
