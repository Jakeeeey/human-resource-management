import { NextRequest, NextResponse } from "next/server";
import { msBindingSchema } from "@/modules/human-resource-management/mailing-studio/studio-bindings/types/ms-binding.schema";
import {
    conditionsMatchReadback,
    loadActiveEventSchemaById,
    validateBindingConditionsById,
} from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/services/condition-guard";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION = "/items/ms_bindings";
const FIELDS = "id,event_key_id,template_id,is_enabled,conditions,priority";

const BODY_KEYS = ["event_key_id", "template_id", "is_enabled", "conditions", "priority"] as const;
type BodyKey = (typeof BODY_KEYS)[number];

function isBodyKey(key: string): key is BodyKey {
    return (BODY_KEYS as readonly string[]).includes(key);
}

function rejectSuspiciousPayload(body: unknown): Record<string, string[]> | null {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return { _body: ["Request body must be a JSON object"] };
    }
    const errors: Record<string, string[]> = {};
    for (const key of Object.keys(body)) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
            errors[key] = [`Forbidden field: ${key}`];
            continue;
        }
        if (!isBodyKey(key)) {
            errors[key] = [`Unknown field: ${key}`];
            continue;
        }
        const value = (body as Record<string, unknown>)[key];
        if (key === "conditions") {
            if (value !== null && typeof value !== "object") {
                errors[key] = ["conditions must be an array of condition records or null"];
            }
            continue;
        }
        if (key === "priority" && value === null) {
            continue;
        }
        if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
            errors[key] = [`${key} must be a string, number, or boolean — objects are never accepted`];
        }
    }
    return Object.keys(errors).length > 0 ? errors : null;
}

function validationFailed(errors: Record<string, string[]>) {
    return NextResponse.json(
        { success: false, message: "Validation failed", errors },
        { status: 400 }
    );
}

async function resolveCurrentEventKeyId(rowId: string | number): Promise<string | number | null> {
    const res = (await dFetch(
        `${COLLECTION}?fields=event_key_id&filter[id][_eq]=${encodeURIComponent(String(rowId))}&limit=1`
    )) as { data?: Array<Record<string, unknown>> };
    const row = Array.isArray(res?.data) ? res.data[0] : undefined;
    const eventKeyId = row?.event_key_id;
    if (typeof eventKeyId !== "string" && typeof eventKeyId !== "number") return null;
    return eventKeyId;
}

async function verifyConditionsPersisted(
    rowId: string | number,
    sentConditions: unknown,
    sentPriority: number | null | undefined
): Promise<boolean> {
    if (sentConditions === undefined && sentPriority === undefined) return true;
    const res = (await dFetch(
        `${COLLECTION}?fields=id,conditions,priority&filter[id][_eq]=${encodeURIComponent(String(rowId))}&limit=1`
    )) as { data?: Array<Record<string, unknown>> };
    const row = Array.isArray(res?.data) ? res.data[0] : undefined;
    if (!row) return false;
    if (sentConditions !== undefined && !conditionsMatchReadback(sentConditions, row.conditions)) return false;
    if (sentPriority !== undefined) {
        const readPriority = row.priority;
        if (sentPriority === null) {
            if (readPriority !== null && readPriority !== undefined) return false;
        } else if (readPriority === null || readPriority === undefined || Number(readPriority) !== sentPriority) {
            return false;
        }
    }
    return true;
}

function persistMismatch() {
    return NextResponse.json(
        { success: false, message: "conditions did not persist (write-then-verify-read mismatch)" },
        { status: 500 }
    );
}

function unknownEventKeyId(event_key_id: string | number) {
    return NextResponse.json(
        { success: false, message: "UNKNOWN_EVENT_KEY", event_key_id },
        { status: 422 }
    );
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id || id.trim() === "") {
            return validationFailed({ id: ["Binding id is required"] });
        }
        const res = (await dFetch(
            `${COLLECTION}/${encodeURIComponent(id)}?fields=${FIELDS}`
        )) as { data?: unknown };
        if (!res?.data) {
            return NextResponse.json(
                { success: false, message: "Binding not found." },
                { status: 404 }
            );
        }
        return NextResponse.json({ success: true, data: res.data });
    } catch (error) {
        console.error("[mailing-studio-bindings] get-by-id error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id || id.trim() === "") {
            return validationFailed({ id: ["Binding id is required"] });
        }
        const body: unknown = await req.json();
        const suspicious = rejectSuspiciousPayload(body);
        if (suspicious) return validationFailed(suspicious);
        if (Object.keys(body as Record<string, unknown>).length === 0) {
            return validationFailed({ _body: ["Nothing to update"] });
        }

        const validation = msBindingSchema.partial().safeParse(body);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }

        if (
            validation.data.event_key_id !== undefined &&
            !(await loadActiveEventSchemaById(validation.data.event_key_id)).active
        ) {
            return unknownEventKeyId(validation.data.event_key_id);
        }

        let eventRef = validation.data.event_key_id;
        if (
            eventRef === undefined &&
            validation.data.conditions !== undefined &&
            validation.data.conditions !== null
        ) {
            const currentEventKeyId = await resolveCurrentEventKeyId(id);
            if (currentEventKeyId === null) {
                return NextResponse.json(
                    { success: false, message: "Binding not found." },
                    { status: 404 }
                );
            }
            if (!(await loadActiveEventSchemaById(currentEventKeyId)).active) {
                return unknownEventKeyId(currentEventKeyId);
            }
            eventRef = currentEventKeyId;
        }

        if (
            eventRef !== undefined &&
            validation.data.conditions !== undefined &&
            validation.data.conditions !== null
        ) {
            const checked = await validateBindingConditionsById(eventRef, validation.data.conditions);
            if (!checked.ok) {
                return validationFailed(checked.errors);
            }
        }

        const res = (await dFetch(`${COLLECTION}/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify(validation.data),
        })) as { data?: unknown };
        if (!res?.data) {
            return NextResponse.json(
                { success: false, message: "Binding not found." },
                { status: 404 }
            );
        }
        if (!(await verifyConditionsPersisted(id, validation.data.conditions, validation.data.priority))) {
            return persistMismatch();
        }
        return NextResponse.json({ success: true, data: res.data });
    } catch (error) {
        console.error("[mailing-studio-bindings] update-by-id error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id || id.trim() === "") {
            return validationFailed({ id: ["Binding id is required"] });
        }
        await dFetch(`${COLLECTION}/${encodeURIComponent(id)}`, { method: "DELETE" });
        return NextResponse.json({
            success: true,
            data: { id },
            message: "Binding unhooked.",
        });
    } catch (error) {
        console.error("[mailing-studio-bindings] delete-by-id error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
