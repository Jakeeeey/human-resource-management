import { NextRequest, NextResponse } from "next/server";
import { msCatalogSchema } from "@/modules/human-resource-management/mailing-studio/types/ms-catalog.schema";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Event-catalog collection routes (P2-T3) — the §6.1 event_catalog table made
// manageable: GET lists keys (?is_active= filter), POST registers one.
// Modelled on the mailing-studio bindings collection route: same
// { success, data?, message?, errors? } envelope, same rejectSuspiciousPayload
// primitive-only guard, same Directus-direct pattern via the shared dFetch.
// Lookups use ?filter= (never /items/:id) so a missing row is an empty list.
// Every mutation does write-then-verify-read — a Directus 200 is never proof
// a write persisted. PATCH/DELETE live on catalog/[key].

const COLLECTION = "/items/event_catalog";
const FIELDS =
    "id,event_key,label,description,module,payload_schema,payload_example,is_active,created_at,updated_at";

const BODY_KEYS = [
    "event_key",
    "label",
    "description",
    "module",
    "payload_schema",
    "payload_example",
    "is_active",
] as const;
type BodyKey = (typeof BODY_KEYS)[number];

function isBodyKey(key: string): key is BodyKey {
    return (BODY_KEYS as readonly string[]).includes(key);
}

// Rejects prototype-pollution keys, unknown keys, and ANY non-primitive
// value (objects, arrays, nested shapes). payload_schema / payload_example
// travel as JSON STRINGS for exactly this reason — parsed server-side after
// the guard. Returns a field-level errors map, or null when clean.
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
        if (
            typeof value !== "string" &&
            typeof value !== "number" &&
            typeof value !== "boolean"
        ) {
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

// PH-time producer (conventions): 'YYYY-MM-DD HH:mm:ss' wall time, never
// server default / UTC toISOString.
function getPhilippineTime(): string {
    return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

interface CatalogRow {
    id: number | string;
    event_key: string;
}

// GET /api/hrm/mailing-studio/catalog[?is_active=...]
// Lists catalog keys ordered by event_key. An invalid filter value is a 400,
// never a silent empty list.
export async function GET(req: NextRequest) {
    try {
        const raw = req.nextUrl.searchParams.get("is_active");
        let clause = "";
        if (raw !== null) {
            const value = raw.trim().toLowerCase();
            if (value !== "true" && value !== "1" && value !== "false" && value !== "0") {
                return NextResponse.json(
                    { success: false, message: "Invalid is_active value. Expected true or false." },
                    { status: 400 }
                );
            }
            const flag = value === "true" || value === "1" ? "true" : "false";
            clause = `&filter[is_active][_eq]=${flag}`;
        }
        const res = (await dFetch(
            `${COLLECTION}?fields=${FIELDS}&sort=event_key&limit=-1${clause}`
        )) as { data?: unknown[] };
        if (!Array.isArray(res?.data)) {
            console.error("[mailing-studio-catalog] list: Directus returned no data array");
            return NextResponse.json(
                { success: false, message: "Failed to list event keys. Please try again later." },
                { status: 500 }
            );
        }
        return NextResponse.json({ success: true, data: res.data });
    } catch (error) {
        console.error("[mailing-studio-catalog] list error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}

// POST /api/hrm/mailing-studio/catalog — register a new event key
// (event_key + label required). Duplicate event_key → 409.
export async function POST(req: NextRequest) {
    try {
        const body: unknown = await req.json();
        const suspicious = rejectSuspiciousPayload(body);
        if (suspicious) return validationFailed(suspicious);

        const validation = msCatalogSchema.safeParse(body);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }

        const { event_key, label } = validation.data;
        const existing = (await dFetch(
            `${COLLECTION}?fields=id&filter[event_key][_eq]=${encodeURIComponent(event_key)}&limit=1`
        )) as { data?: unknown[] };
        if (Array.isArray(existing?.data) && existing.data.length > 0) {
            return NextResponse.json(
                { success: false, message: "Event key already exists.", event_key },
                { status: 409 }
            );
        }

        const now = getPhilippineTime();
        const payload: Record<string, unknown> = {
            event_key,
            label,
            description: validation.data.description ?? "",
            module: validation.data.module ?? null,
            payload_schema: validation.data.payload_schema
                ? (JSON.parse(validation.data.payload_schema) as unknown)
                : {},
            payload_example: validation.data.payload_example
                ? (JSON.parse(validation.data.payload_example) as unknown)
                : {},
            is_active: validation.data.is_active ?? true,
            created_at: now,
            updated_at: now,
        };
        const written = (await dFetch(COLLECTION, {
            method: "POST",
            body: JSON.stringify(payload),
        })) as { data?: CatalogRow };
        if (!written?.data) {
            console.error("[mailing-studio-catalog] create: Directus returned no data");
            return NextResponse.json(
                { success: false, message: "Failed to register event key. Please try again later." },
                { status: 500 }
            );
        }

        // write-then-verify-read: trust the re-read row, never the write echo.
        const verified = (await dFetch(
            `${COLLECTION}?fields=${FIELDS}&filter[event_key][_eq]=${encodeURIComponent(event_key)}&limit=1`
        )) as { data?: CatalogRow[] };
        const row = Array.isArray(verified?.data) ? verified.data[0] : undefined;
        if (!row || row.event_key !== event_key) {
            console.error("[mailing-studio-catalog] create: write not found on read-back");
            return NextResponse.json(
                { success: false, message: "Event key write not found on read-back." },
                { status: 500 }
            );
        }
        return NextResponse.json({ success: true, data: row });
    } catch (error) {
        console.error("[mailing-studio-catalog] create error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
