import { createHash } from "node:crypto";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

import { msLogRedacted } from "./mail-transport";

// Server-side catalog validation for the emit surface (P3-T3, D4 + D5).
// `event_key` is validated against the event_catalog TABLE at runtime:
// shape first (shared Zod), then existence + is_active via a ?filter= lookup
// (never /items/:id, so a missing key is an empty list). Server-only —
// rides the shared dFetch transport. Also owns the §7.2 idempotency
// derivation so the emit route and the relay agree byte-wise.

const CATALOG_COLLECTION = "/items/event_catalog";

/** §7.6 payload limits. */
export const MS_EMIT_PAYLOAD_MAX = 32768;
export const MS_EMIT_PAYLOAD_MAX_KEYS = 100;
export const MS_EMIT_PAYLOAD_MAX_DEPTH = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toBool(value: unknown): boolean {
    return value === true || value === 1 || value === "1" || value === "true";
}

/**
 * True only when `key` names an ACTIVE event_catalog row. Lookup failures
 * fail closed (false) — an unreadable catalog must not admit sends.
 * @param key - Candidate event key.
 */
export async function isActiveCatalogKey(key: string): Promise<boolean> {
    try {
        if (typeof key !== "string" || key.length === 0) return false;
        const res = (await dFetch(
            `${CATALOG_COLLECTION}?fields=event_key&filter[event_key][_eq]=${encodeURIComponent(key)}&filter[is_active][_eq]=true&limit=1`,
        )) as { data?: unknown[] };
        return Array.isArray(res?.data) && res.data.length > 0;
    } catch (error) {
        msLogRedacted("[catalog-guard] catalog lookup failed (failing closed):", error);
        return false;
    }
}

/**
 * Fetches the catalog row's payload_schema document (parsed object or null).
 */
async function fetchPayloadSchema(key: string): Promise<unknown> {
    try {
        const res = (await dFetch(
            `${CATALOG_COLLECTION}?fields=payload_schema&filter[event_key][_eq]=${encodeURIComponent(key)}&limit=1`,
        )) as { data?: Record<string, unknown>[] };
        const row = Array.isArray(res?.data) ? res.data[0] : undefined;
        if (!isRecord(row)) return null;
        const schema = row.payload_schema;
        if (typeof schema === "string") {
            try {
                return JSON.parse(schema) as unknown;
            } catch {
                return null;
            }
        }
        return schema ?? null;
    } catch (error) {
        msLogRedacted("[catalog-guard] payload_schema fetch failed:", error);
        return null;
    }
}

/**
 * Measures object nesting depth (scalars/arrays-of-scalars = 1 level each).
 */
function payloadDepth(value: unknown): number {
    if (Array.isArray(value)) {
        let deepest = 0;
        for (const item of value) {
            const child = payloadDepth(item);
            if (child > deepest) deepest = child;
        }
        return 1 + deepest;
    }
    if (!isRecord(value)) return 1;
    let deepest = 0;
    for (const entry of Object.values(value)) {
        const child = payloadDepth(entry);
        if (child > deepest) deepest = child;
    }
    return 1 + deepest;
}

function matchesSchemaType(value: unknown, declared: string): boolean {
    switch (declared) {
        case "string":
            return typeof value === "string";
        case "number":
            return typeof value === "number";
        case "integer":
            return typeof value === "number" && Number.isInteger(value);
        case "boolean":
            return typeof value === "boolean" || value === 1 || value === 0;
        case "array":
            return Array.isArray(value);
        case "object":
            return isRecord(value);
        case "null":
            return value === null;
        default:
            return true;
    }
}

/**
 * Validates an emit payload: must be an object, within the §7.6 key/depth
 * caps, and conforming to the catalog row's payload_schema document
 * (`required[]` presence + `properties{}.type` checks — a documentation
 * subset, not a full JSON-Schema engine).
 * @param key - Active catalog event key.
 * @param payload - Candidate emit payload.
 * @returns ok + field-level errors (empty map when valid).
 */
export async function validatePayload(
    key: string,
    payload: unknown,
): Promise<{ ok: boolean; errors: Record<string, string[]> }> {
    if (!isRecord(payload)) {
        return { ok: false, errors: { payload: ["Payload must be a JSON object"] } };
    }
    if (Object.keys(payload).length > MS_EMIT_PAYLOAD_MAX_KEYS) {
        return {
            ok: false,
            errors: {
                payload: [
                    `Payload must have at most ${MS_EMIT_PAYLOAD_MAX_KEYS} keys`,
                ],
            },
        };
    }
    if (payloadDepth(payload) > MS_EMIT_PAYLOAD_MAX_DEPTH) {
        return {
            ok: false,
            errors: {
                payload: [
                    `Payload must nest at most ${MS_EMIT_PAYLOAD_MAX_DEPTH} levels deep`,
                ],
            },
        };
    }
    const schema = await fetchPayloadSchema(key);
    if (!isRecord(schema)) return { ok: true, errors: {} };
    const errors: Record<string, string[]> = {};
    const required = schema.required;
    if (Array.isArray(required)) {
        for (const name of required) {
            if (typeof name !== "string") continue;
            if (!(name in payload)) {
                errors[name] = [`${name} is required by the event schema`];
            }
        }
    }
    const properties = schema.properties;
    if (isRecord(properties)) {
        for (const [name, declared] of Object.entries(properties)) {
            if (!isRecord(declared)) continue;
            const type = declared.type;
            if (typeof type !== "string") continue;
            const value = payload[name];
            if (value === undefined) continue;
            if (!matchesSchemaType(value, type)) {
                errors[name] = [`${name} must be of type ${type}`];
            }
        }
    }
    return { ok: Object.keys(errors).length === 0, errors };
}

/**
 * Deterministic JSON stringify (sorted keys) so identical payloads hash
 * identically regardless of key insertion order.
 */
export function stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    }
    if (isRecord(value)) {
        const keys = Object.keys(value).sort();
        const parts = keys.map(
            (key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`,
        );
        return `{${parts.join(",")}}`;
    }
    const serialized = JSON.stringify(value);
    return typeof serialized === "string" ? serialized : "null";
}

/**
 * Derives the idempotency key (§7.2): caller-supplied verbatim; else
 * `<event_key>:<payload.id>` when the payload carries an id; else
 * `<event_key>:<sha256(payload)[0..16]>` (deterministic — an identical
 * re-emit dedupes).
 * @param eventKey - Catalog event key.
 * @param payload - Emit payload.
 * @param callerKey - Optional caller-supplied key (used verbatim).
 */
export function deriveIdempotencyKey(
    eventKey: string,
    payload: Record<string, unknown>,
    callerKey?: unknown,
): string {
    if (typeof callerKey === "string" && callerKey.length > 0) return callerKey;
    const id = payload.id;
    if (
        (typeof id === "string" && id.length > 0) ||
        (typeof id === "number" && Number.isFinite(id))
    ) {
        return `${eventKey}:${String(id)}`;
    }
    const digest = createHash("sha256").update(stableStringify(payload)).digest("hex");
    return `${eventKey}:${digest.slice(0, 16)}`;
}

/**
 * Serialized payload size in bytes (UTF-8) for the §7.6 size cap.
 */
export function serializedPayloadSize(payload: Record<string, unknown>): number {
    return Buffer.byteLength(stableStringify(payload), "utf8");
}

/** True when a catalog row's is_active flag reads as active (1/0 tolerant). */
export function isCatalogRowActive(row: unknown): boolean {
    return isRecord(row) ? toBool(row.is_active) : false;
}
