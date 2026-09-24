import { NextRequest, NextResponse } from "next/server";
import {
    msCatalogSchema,
    msEventKeyShapeSchema,
} from "@/modules/human-resource-management/mailing-studio/types/ms-catalog.schema";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Event-catalog by-key routes (P2-T3): PATCH updates a key, DELETE retires it
// (soft-delete via is_active=false — the row survives, inactive). Same
// envelope, guard, dFetch-direct and ?filter=-lookup idioms as the collection
// route. Unknown keys → 404; invalid shape → 400. event_key is immutable —
// the path key owns identity, so a differing body event_key is rejected.
// Every mutation does write-then-verify-read.

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

function getPhilippineTime(): string {
    return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

interface CatalogRow {
    id: number | string;
    event_key: string;
}

// Reads one catalog row by event_key via ?filter= (never /items/:id for a
// possibly-missing row) — null when absent, dodging Directus's
// missing-single-item 403 gotcha.
async function getCatalogRow(event_key: string): Promise<CatalogRow | null> {
    const res = (await dFetch(
        `${COLLECTION}?fields=${FIELDS}&filter[event_key][_eq]=${encodeURIComponent(event_key)}&limit=1`
    )) as { data?: CatalogRow[] };
    if (!Array.isArray(res?.data)) return null;
    return res.data[0] ?? null;
}

// PATCH /api/hrm/mailing-studio/catalog/:key — partial update of one key.
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ key: string }> }
) {
    try {
        const { key } = await params;
        if (msEventKeyShapeSchema.safeParse(key).success !== true) {
            return validationFailed({ event_key: ["Invalid event key shape"] });
        }
        const existing = await getCatalogRow(key);
        if (!existing) {
            return NextResponse.json(
                { success: false, message: "Event key not found.", event_key: key },
                { status: 404 }
            );
        }

        const body: unknown = await req.json();
        const suspicious = rejectSuspiciousPayload(body);
        if (suspicious) return validationFailed(suspicious);
        const record = { ...(body as Record<string, unknown>) };

        // event_key is immutable — the path key owns identity.
        if (record.event_key !== undefined && record.event_key !== key) {
            return validationFailed({ event_key: ["event_key cannot be changed"] });
        }
        delete record.event_key;
        if (Object.keys(record).length === 0) {
            return validationFailed({ _body: ["Nothing to update"] });
        }

        const validation = msCatalogSchema.partial().safeParse(record);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }

        const patch: Record<string, unknown> = {
            ...validation.data,
            updated_at: getPhilippineTime(),
        };
        if (typeof patch.payload_schema === "string") {
            patch.payload_schema = JSON.parse(patch.payload_schema) as unknown;
        }
        if (typeof patch.payload_example === "string") {
            patch.payload_example = JSON.parse(patch.payload_example) as unknown;
        }

        const written = (await dFetch(`${COLLECTION}/${String(existing.id)}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
        })) as { data?: unknown };
        if (!written?.data) {
            console.error("[mailing-studio-catalog] update: Directus returned no data");
            return NextResponse.json(
                { success: false, message: "Event key not found.", event_key: key },
                { status: 404 }
            );
        }

        const verified = await getCatalogRow(key);
        if (!verified) {
            console.error("[mailing-studio-catalog] update: write not found on read-back");
            return NextResponse.json(
                { success: false, message: "Event key write not found on read-back." },
                { status: 500 }
            );
        }
        return NextResponse.json({ success: true, data: verified });
    } catch (error) {
        console.error("[mailing-studio-catalog] update error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}

// DELETE /api/hrm/mailing-studio/catalog/:key — soft-retire via
// is_active=false (the row survives, inactive). Already-retired → same row.
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ key: string }> }
) {
    try {
        const { key } = await params;
        if (msEventKeyShapeSchema.safeParse(key).success !== true) {
            return validationFailed({ event_key: ["Invalid event key shape"] });
        }
        const existing = await getCatalogRow(key);
        if (!existing) {
            return NextResponse.json(
                { success: false, message: "Event key not found.", event_key: key },
                { status: 404 }
            );
        }

        const written = (await dFetch(`${COLLECTION}/${String(existing.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ is_active: false, updated_at: getPhilippineTime() }),
        })) as { data?: unknown };
        if (!written?.data) {
            console.error("[mailing-studio-catalog] retire: Directus returned no data");
            return NextResponse.json(
                { success: false, message: "Event key not found.", event_key: key },
                { status: 404 }
            );
        }

        const verified = await getCatalogRow(key);
        if (!verified) {
            console.error("[mailing-studio-catalog] retire: write not found on read-back");
            return NextResponse.json(
                { success: false, message: "Event key write not found on read-back." },
                { status: 500 }
            );
        }
        return NextResponse.json({
            success: true,
            data: verified,
            message: "Event key retired.",
        });
    } catch (error) {
        console.error("[mailing-studio-catalog] retire error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
