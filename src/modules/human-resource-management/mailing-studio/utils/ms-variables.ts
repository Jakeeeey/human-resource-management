import { extractTemplateTokens } from "./template-render";

export const MS_VARIABLES_MAX = 200;

const TOKEN_KEY_PATTERN = /^[A-Za-z0-9_.]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Compiles the derived `ms_templates.variables` cache (§6.4) from a
 * stringified canvas doc: the distinct `{{ key }}` tokens in bare canonical
 * form, sorted. Never hand-edited — the template owns this list so one edit
 * cannot fan out to N binding rows.
 */
export function compileVariablesFromDesignJson(design_json: string): string[] {
    return extractTemplateTokens(design_json).slice(0, MS_VARIABLES_MAX);
}

/**
 * Parses a Directus JSON document that may arrive as an object, a JSON
 * string, or null (booleans arrive 1/0, JSON arrives parsed — but a
 * hand-pasted catalog edit can leave a raw string behind).
 */
export function parseJsonDocument(value: unknown): unknown {
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length === 0) return null;
        try {
            return JSON.parse(trimmed) as unknown;
        } catch {
            return null;
        }
    }
    return value ?? null;
}

/**
 * Derives the provided key names for one event: the top-level keys of
 * `payload_schema` (via its `properties` when it is a JSON Schema document,
 * else its own keys), unioned with the top-level keys of `payload_example`.
 * The token name IS the payload key (§7.7), so these are the only names a
 * template bound to this event may use without reporting unmapped.
 */
export function extractPayloadKeys(schema: unknown, example: unknown): string[] {
    const keys = new Set<string>();
    const schemaDoc = parseJsonDocument(schema);
    if (isRecord(schemaDoc)) {
        const properties = schemaDoc["properties"];
        const source = isRecord(properties) ? properties : schemaDoc;
        for (const key of Object.keys(source)) {
            if (key.length > 0 && TOKEN_KEY_PATTERN.test(key)) keys.add(key);
        }
    }
    const exampleDoc = parseJsonDocument(example);
    if (isRecord(exampleDoc)) {
        for (const key of Object.keys(exampleDoc)) {
            if (key.length > 0 && TOKEN_KEY_PATTERN.test(key)) keys.add(key);
        }
    }
    return [...keys].sort();
}

/**
 * Derives a sample payload object from a catalog row's `payload_example`
 * for the canvas sample preview (D3): template `{{tokens}}` rendered through
 * `renderTemplate` against these values. Non-record documents yield an empty
 * payload, which renders every token as "" + `unknown-var:*` — never throws.
 */
export function extractPayloadExample(example: unknown): Record<string, unknown> {
    const doc = parseJsonDocument(example);
    return isRecord(doc) ? doc : {};
}

export interface TokenClassification {
    provided: string[];
    unmapped: string[];
}

/**
 * Classifies each compiled template token against one event's provided keys
 * (§7.7): present in `payload_schema` → provided; absent → unmapped (a
 * hand-typed key the event does not send, or a schema that changed under the
 * template). Reported, never auto-repaired.
 */
export function classifyTokens(variables: readonly string[], providedKeys: readonly string[]): TokenClassification {
    const providedSet = new Set(providedKeys);
    const provided: string[] = [];
    const unmapped: string[] = [];
    for (const token of [...variables].sort()) {
        if (providedSet.has(token)) provided.push(token);
        else unmapped.push(token);
    }
    return { provided, unmapped };
}

/**
 * Normalises a `variables` value read back from Directus to a sorted string
 * array for the write-then-verify-read comparison (JSON columns arrive
 * parsed, but tolerate a raw string or a missing column).
 */
export function normaliseVariablesList(value: unknown): string[] {
    const doc = parseJsonDocument(value);
    if (!Array.isArray(doc)) return [];
    return doc
        .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
        .sort();
}
