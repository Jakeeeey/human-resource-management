import { NextRequest, NextResponse } from "next/server";
import { msBindingSchema } from "@/modules/human-resource-management/mailing-studio/studio-bindings/types/ms-binding.schema";
import {
    conditionsMatchReadback,
    loadActiveEventSchemaById,
    validateBindingConditionsById,
} from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/services/condition-guard";
import { dFetch } from "@/modules/human-resource-management/mailing-studio/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION = "/items/ms_bindings";
const FIELDS = "id,event_key_id,template_id,is_enabled,conditions,priority";

const BODY_KEYS = ["event_key_id", "template_id", "is_enabled", "conditions", "priority"] as const;
type BodyKey = (typeof BODY_KEYS)[number];

function isBodyKey(key: string): key is BodyKey {
    return (BODY_KEYS as readonly string[]).includes(key);
}

function rejectSuspiciousPayload(body: unknown, allowId: boolean): Record<string, string[]> | null {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return { _body: ["Request body must be a JSON object"] };
    }
    const errors: Record<string, string[]> = {};
    for (const key of Object.keys(body)) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
            errors[key] = [`Forbidden field: ${key}`];
            continue;
        }
        if (key === "id") {
            if (!allowId) errors[key] = ["Field not allowed here"];
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

function parseEventKeyId(value: unknown): string | null {
    if (typeof value === "number") {
        if (!Number.isInteger(value) || value <= 0) return null;
        return String(value);
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!/^\d+$/.test(trimmed)) return null;
        if (Number(trimmed) <= 0) return null;
        return trimmed;
    }
    return null;
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

export async function GET(req: NextRequest) {
    try {
        const params = req.nextUrl.searchParams;
        const filter: string[] = [];

        const rawEventKeyId = params.get("event_key_id");
        if (rawEventKeyId !== null) {
            const parsed = parseEventKeyId(rawEventKeyId);
            if (parsed === null) {
                return validationFailed({ event_key_id: ["Invalid event key id"] });
            }
            filter.push(`event_key_id[eq]=${encodeURIComponent(parsed)}`);
        }

        const rawEnabled = params.get("is_enabled");
        if (rawEnabled !== null) {
            if (rawEnabled !== "true" && rawEnabled !== "false") {
                return validationFailed({ is_enabled: ["Must be true or false"] });
            }
            filter.push(`is_enabled[eq]=${rawEnabled}`);
        }

        const clauses = filter.map((clause) => {
            const [field, rest] = clause.split("[eq]=");
            return `filter[${field}][_eq]=${rest}`;
        });
        const qs = clauses.length > 0 ? `&${clauses.join("&")}` : "";
        const res = (await dFetch(
            `${COLLECTION}?fields=${FIELDS}&sort=id&limit=-1${qs}`
        )) as { data?: unknown[] };
        if (!Array.isArray(res?.data)) {
            console.error("[mailing-studio-bindings] list: Directus returned no data array");
            return NextResponse.json(
                { success: false, message: "Failed to list bindings. Please try again later." },
                { status: 500 }
            );
        }
        return NextResponse.json({ success: true, data: res.data });
    } catch (error) {
        console.error("[mailing-studio-bindings] list error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body: unknown = await req.json();
        const suspicious = rejectSuspiciousPayload(body, false);
        if (suspicious) return validationFailed(suspicious);

        const validation = msBindingSchema.safeParse(body);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }

        if (!(await loadActiveEventSchemaById(validation.data.event_key_id)).active) {
            return unknownEventKeyId(validation.data.event_key_id);
        }

        if (validation.data.conditions !== undefined && validation.data.conditions !== null) {
            const checked = await validateBindingConditionsById(
                validation.data.event_key_id,
                validation.data.conditions
            );
            if (!checked.ok) {
                return validationFailed(checked.errors);
            }
        }

        const res = (await dFetch(COLLECTION, {
            method: "POST",
            body: JSON.stringify(validation.data),
        })) as { data?: unknown };
        if (!res?.data) {
            console.error("[mailing-studio-bindings] create: Directus returned no data");
            return NextResponse.json(
                { success: false, message: "Failed to create binding. Please try again later." },
                { status: 500 }
            );
        }
        const created = res.data as Record<string, unknown>;
        const createdId = created.id;
        if (typeof createdId !== "string" && typeof createdId !== "number") {
            return persistMismatch();
        }
        if (!(await verifyConditionsPersisted(createdId, validation.data.conditions, validation.data.priority))) {
            return persistMismatch();
        }
        return NextResponse.json({ success: true, data: res.data });
    } catch (error) {
        console.error("[mailing-studio-bindings] create error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const body: unknown = await req.json();
        const suspicious = rejectSuspiciousPayload(body, true);
        if (suspicious) return validationFailed(suspicious);

        const record = body as Record<string, unknown>;
        const rawId = record.id;
        if (typeof rawId !== "string" && typeof rawId !== "number") {
            return validationFailed({ id: ["Binding id is required"] });
        }
        if (typeof rawId === "string" && rawId.trim() === "") {
            return validationFailed({ id: ["Binding id is required"] });
        }

        const { id: _id, ...patch } = record;
        void _id;
        if (Object.keys(patch).length === 0) {
            return validationFailed({ _body: ["Nothing to update"] });
        }

        const validation = msBindingSchema.partial().safeParse(patch);
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
            const currentEventKeyId = await resolveCurrentEventKeyId(rawId);
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

        const res = (await dFetch(`${COLLECTION}/${encodeURIComponent(String(rawId))}`, {
            method: "PATCH",
            body: JSON.stringify(validation.data),
        })) as { data?: unknown };
        if (!res?.data) {
            console.error("[mailing-studio-bindings] update: Directus returned no data");
            return NextResponse.json(
                { success: false, message: "Binding not found." },
                { status: 404 }
            );
        }
        if (!(await verifyConditionsPersisted(rawId, validation.data.conditions, validation.data.priority))) {
            return persistMismatch();
        }
        return NextResponse.json({ success: true, data: res.data });
    } catch (error) {
        console.error("[mailing-studio-bindings] update error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
