import { NextRequest, NextResponse } from "next/server";
import {
    msBindingSchema,
    msSendConditionSchema,
} from "@/modules/human-resource-management/mailing-studio/types/ms-binding.schema";
import { msEventKeySchema } from "@/modules/human-resource-management/mailing-studio/types/ms-template.schema";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bindings collection routes (T4) — READ-ONLY copy of the old
// api/hrm/mailing/bindings route, retargeted to ms_bindings with the
// mailing-studio schemas. Envelope { success, data?, message?, errors? } and
// status codes mirror the old route byte-for-byte where they overlap.
//
// `event_key` is restricted to the 3 frozen keys and `send_condition` to the
// `always|on_pass|on_fail` trio — both enforced by the frozen Zod enums, with
// NO refinement layered on top. There is no condition DSL anywhere in this
// module: any object/array/nested payload for `send_condition` (or any other
// field) is rejected with a 400 before it reaches Zod. PATCH
// `is_enabled:false` is the soft unhook; hard unhook (DELETE) lives on
// bindings/[id].

const COLLECTION = "/items/ms_bindings";
const FIELDS = "id,event_key,template_id,is_enabled,send_condition";

const BODY_KEYS = ["event_key", "template_id", "is_enabled", "send_condition"] as const;
type BodyKey = (typeof BODY_KEYS)[number];

function isBodyKey(key: string): key is BodyKey {
    return (BODY_KEYS as readonly string[]).includes(key);
}

// Rejects prototype-pollution keys, unknown keys, and ANY non-primitive
// value (objects, arrays, nested DSL shapes like {field,op,value}).
// Returns a field-level errors map, or null when the payload is clean.
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

// GET /api/hrm/mailing-studio/bindings[?event_key=...][?send_condition=...][?is_enabled=...]
// Lists bindings. Optional filters are validated against the frozen enums —
// an unknown filter value is a 400, never a silent empty list.
export async function GET(req: NextRequest) {
    try {
        const params = req.nextUrl.searchParams;
        const filter: string[] = [];

        const rawEventKey = params.get("event_key");
        if (rawEventKey !== null) {
            const parsed = msEventKeySchema.safeParse(rawEventKey);
            if (!parsed.success) {
                return validationFailed({ event_key: ["Unknown event key"] });
            }
            filter.push(`event_key[eq]=${encodeURIComponent(parsed.data)}`);
        }

        const rawCondition = params.get("send_condition");
        if (rawCondition !== null) {
            const parsed = msSendConditionSchema.safeParse(rawCondition);
            if (!parsed.success) {
                return validationFailed({ send_condition: ["Unknown send condition"] });
            }
            filter.push(`send_condition[eq]=${encodeURIComponent(parsed.data)}`);
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

// POST /api/hrm/mailing-studio/bindings — hook a new binding (full row required).
export async function POST(req: NextRequest) {
    try {
        const body: unknown = await req.json();
        const suspicious = rejectSuspiciousPayload(body, false);
        if (suspicious) return validationFailed(suspicious);

        const validation = msBindingSchema.safeParse(body);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
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
        return NextResponse.json({ success: true, data: res.data });
    } catch (error) {
        console.error("[mailing-studio-bindings] create error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}

// PATCH /api/hrm/mailing-studio/bindings — body carries `{ id, ...partial }`.
// PATCH `is_enabled:false` is the soft unhook (row survives, disabled).
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
        return NextResponse.json({ success: true, data: res.data });
    } catch (error) {
        console.error("[mailing-studio-bindings] update error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
