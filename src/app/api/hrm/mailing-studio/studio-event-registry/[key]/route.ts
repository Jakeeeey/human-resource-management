import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
    msEventKeyShapeSchema,
    msVariableListSchema,
} from "@/modules/human-resource-management/mailing-studio/studio-event-registry/types/ms-catalog.schema";
import {
    buildPayloadExample,
    buildPayloadSchema,
    validateVariableRows,
} from "@/modules/human-resource-management/mailing-studio/studio-event-registry/utils/ms-event-variables";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION = "/items/event_catalog";
const FIELDS =
    "id,event_key,label,description,module,payload_schema,payload_example,is_active,created_at,updated_at";

const BODY_KEYS = [
    "event_key",
    "label",
    "description",
    "module",
    "variables",
    "is_active",
] as const;
type BodyKey = (typeof BODY_KEYS)[number];

const VARIABLE_KEYS = ["name", "type", "example"] as const;

function isBodyKey(key: string): key is BodyKey {
    return (BODY_KEYS as readonly string[]).includes(key);
}

function isVariableEntry(value: unknown): boolean {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") return false;
        if (!(VARIABLE_KEYS as readonly string[]).includes(key)) return false;
        const entry = record[key];
        if (typeof entry !== "string") return false;
    }
    return typeof record["name"] === "string";
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
        if (key === "variables") {
            if (
                !Array.isArray(value) ||
                !value.every(isVariableEntry)
            ) {
                errors[key] = [`${key} must be an array of { name, type, example } string rows`];
            }
            continue;
        }
        if (
            value !== null &&
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

const registryPatchSchema = z.object({
    label: z.string().min(1, "Label is required").optional(),
    description: z.string().optional().nullable(),
    module: z.string().optional().nullable(),
    variables: msVariableListSchema.optional(),
    is_active: z.boolean().optional(),
});

interface CatalogRow {
    id: number | string;
    event_key: string;
}

async function getCatalogRow(event_key: string): Promise<CatalogRow | null> {
    const res = (await dFetch(
        `${COLLECTION}?fields=${FIELDS}&filter[event_key][_eq]=${encodeURIComponent(event_key)}&limit=1`
    )) as { data?: CatalogRow[] };
    if (!Array.isArray(res?.data)) return null;
    return res.data[0] ?? null;
}

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

        if (record.event_key !== undefined && record.event_key !== key) {
            return validationFailed({ event_key: ["event_key cannot be changed"] });
        }
        delete record.event_key;
        if (Object.keys(record).length === 0) {
            return validationFailed({ _body: ["Nothing to update"] });
        }

        const validation = registryPatchSchema.safeParse(record);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }

        const rows = validation.data.variables;
        if (rows !== undefined) {
            const rowsProblem = validateVariableRows(rows);
            if (rowsProblem !== null) {
                return validationFailed({ variables: [rowsProblem] });
            }
        }

        const patch: Record<string, unknown> = {
            ...validation.data,
            updated_at: getPhilippineTime(),
        };
        if (rows !== undefined) {
            patch.payload_schema = buildPayloadSchema(rows);
            patch.payload_example = buildPayloadExample(rows);
            delete patch.variables;
        }

        const written = (await dFetch(`${COLLECTION}/${String(existing.id)}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
        })) as { data?: unknown };
        if (!written?.data) {
            console.error("[mailing-studio-event-registry] update: Directus returned no data");
            return NextResponse.json(
                { success: false, message: "Event key not found.", event_key: key },
                { status: 404 }
            );
        }

        const verified = await getCatalogRow(key);
        if (!verified) {
            console.error("[mailing-studio-event-registry] update: write not found on read-back");
            return NextResponse.json(
                { success: false, message: "Event key write not found on read-back." },
                { status: 500 }
            );
        }
        return NextResponse.json({ success: true, data: verified });
    } catch (error) {
        console.error("[mailing-studio-event-registry] update error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}

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
            console.error("[mailing-studio-event-registry] retire: Directus returned no data");
            return NextResponse.json(
                { success: false, message: "Event key not found.", event_key: key },
                { status: 404 }
            );
        }

        const verified = await getCatalogRow(key);
        if (!verified) {
            console.error("[mailing-studio-event-registry] retire: write not found on read-back");
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
        console.error("[mailing-studio-event-registry] retire error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
