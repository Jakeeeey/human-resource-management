import { z } from "zod";

// Event-catalog key shape (§7.5): lowercase letters, digits, dots, underscores.
// Single source of truth — ms-binding.schema.ts imports this instead of
// carrying its own copy, so the bindings path and the catalog agree byte-wise.
export const MS_EVENT_KEY_PATTERN = /^[a-z0-9_.]+$/;

export const msEventKeyShapeSchema = z
    .string()
    .min(1, "Event key is required")
    .regex(
        MS_EVENT_KEY_PATTERN,
        "Event key may only contain lowercase letters, digits, dots and underscores",
    );

function isValidJson(value: string): boolean {
    try {
        JSON.parse(value);
        return true;
    } catch {
        return false;
    }
}

// payload_schema / payload_example travel as JSON STRINGS on the wire so the
// primitive-only write guard (rejectSuspiciousPayload) stays byte-identical
// with the bindings routes — the same precedent as design_json in the
// templates path. The route parses them to objects before writing Directus,
// where they are stored as JSON documents (standing invariant: a JSON
// document is data, never executable content).
const jsonDocumentSchema = z
    .string()
    .min(1, "JSON document must not be empty")
    .refine(isValidJson, "Must be valid JSON");

// event_catalog row (§6.1) — write shape for POST/PATCH bodies. id and the
// audit timestamps are server-owned (PH wall-clock, written by the route),
// never accepted from the body.
export const msCatalogSchema = z.object({
    event_key: msEventKeyShapeSchema,
    label: z.string().min(1, "Label is required"),
    description: z.string().optional().nullable(),
    module: z.string().optional().nullable(),
    payload_schema: jsonDocumentSchema.optional().nullable(),
    payload_example: jsonDocumentSchema.optional().nullable(),
    is_active: z.boolean().optional(),
});

export type MsCatalog = z.infer<typeof msCatalogSchema>;

// event_catalog row as READ back from Directus: id is always present
// (Directus-managed PK alongside the UNIQUE event_key), booleans arrive as
// 1/0, and the JSON columns arrive parsed (objects, not strings).
export interface MsCatalogRow {
    id: number | string;
    event_key: string;
    label: string;
    description: string | null;
    module: string | null;
    payload_schema: unknown;
    payload_example: unknown;
    is_active: boolean | number;
    created_at?: string | null;
    updated_at?: string | null;
}
