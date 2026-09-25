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

const registryCreateSchema = z.object({
    event_key: msEventKeyShapeSchema,
    label: z.string().min(1, "Label is required"),
    description: z.string().optional().nullable(),
    module: z.string().optional().nullable(),
    variables: msVariableListSchema.optional(),
    is_active: z.boolean().optional(),
});

interface CatalogRow {
    id: number | string;
    event_key: string;
}

export async function POST(req: NextRequest) {
    try {
        const body: unknown = await req.json();
        const suspicious = rejectSuspiciousPayload(body);
        if (suspicious) return validationFailed(suspicious);

        const validation = registryCreateSchema.safeParse(body);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }

        const rows = validation.data.variables ?? [];
        const rowsProblem = validateVariableRows(rows);
        if (rowsProblem !== null) {
            return validationFailed({ variables: [rowsProblem] });
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
            payload_schema: buildPayloadSchema(rows),
            payload_example: buildPayloadExample(rows),
            is_active: validation.data.is_active ?? true,
            created_at: now,
            updated_at: now,
        };
        const written = (await dFetch(COLLECTION, {
            method: "POST",
            body: JSON.stringify(payload),
        })) as { data?: CatalogRow };
        if (!written?.data) {
            console.error("[mailing-studio-event-registry] create: Directus returned no data");
            return NextResponse.json(
                { success: false, message: "Failed to register event key. Please try again later." },
                { status: 500 }
            );
        }

        const verified = (await dFetch(
            `${COLLECTION}?fields=${FIELDS}&filter[event_key][_eq]=${encodeURIComponent(event_key)}&limit=1`
        )) as { data?: CatalogRow[] };
        const row = Array.isArray(verified?.data) ? verified.data[0] : undefined;
        if (!row || row.event_key !== event_key) {
            console.error("[mailing-studio-event-registry] create: write not found on read-back");
            return NextResponse.json(
                { success: false, message: "Event key write not found on read-back." },
                { status: 500 }
            );
        }
        return NextResponse.json({ success: true, data: row });
    } catch (error) {
        console.error("[mailing-studio-event-registry] create error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
