import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dispatchMail } from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/services/dispatch-service";
import { msEventKeyShapeSchema } from "@/modules/human-resource-management/mailing-studio/studio-bindings/catalog/ms-catalog.schema";
import { buildManualIdempotencyKey } from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/utils/ms-idempotency";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BindingLookupRow {
    id?: unknown;
    event_key_id?: unknown;
    is_enabled?: unknown;
}

interface CatalogLookupRow {
    id?: unknown;
    event_key?: unknown;
    is_active?: unknown;
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

async function isActiveCatalogKey(key: string): Promise<boolean> {
    try {
        const res = (await dFetch(
            `/items/event_catalog?fields=event_key&filter[event_key][_eq]=${encodeURIComponent(key)}&filter[is_active][_eq]=true&limit=1`
        )) as { data?: unknown[] };
        return Array.isArray(res?.data) && res.data.length > 0;
    } catch {
        return false;
    }
}

async function resolveActiveCatalogKeyById(eventKeyId: string | number): Promise<string | null> {
    try {
        const res = (await dFetch(
            `/items/event_catalog?fields=id,event_key&filter[id][_eq]=${encodeURIComponent(String(eventKeyId))}&filter[is_active][_eq]=true&limit=1`
        )) as { data?: CatalogLookupRow[] };
        const row = Array.isArray(res?.data) ? res.data[0] : undefined;
        if (!row || !toBool(row.is_active)) return null;
        if (typeof row.event_key !== "string" || row.event_key.length === 0) return null;
        return row.event_key;
    } catch {
        return null;
    }
}

function unknownEventKey(eventKey: string) {
    return NextResponse.json(
        { success: false, message: "UNKNOWN_EVENT_KEY", event_key: eventKey },
        { status: 422 }
    );
}

const sendNowSchema = z
    .object({
        event_key: msEventKeyShapeSchema.optional(),
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
            const res = (await dFetch(
                `/items/ms_bindings?filter[id][_eq]=${encodeURIComponent(ref)}` +
                    "&fields=id,event_key_id,template_id,is_enabled&limit=1"
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
            const rawKeyId = row.event_key_id;
            if (
                (typeof rawKeyId !== "string" || rawKeyId.trim() === "") &&
                typeof rawKeyId !== "number"
            ) {
                return validationFailed({ event_key: ["Unknown event key"] });
            }
            const resolved = await resolveActiveCatalogKeyById(rawKeyId as string | number);
            if (resolved === null) {
                return validationFailed({ event_key: ["Unknown event key"] });
            }
            eventKey = resolved;
        } else {
            eventKey = validation.data.event_key as string;
            ref = eventKey;
            if (!(await isActiveCatalogKey(eventKey))) {
                return unknownEventKey(eventKey);
            }
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
