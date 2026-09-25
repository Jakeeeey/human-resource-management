import {
    MS_VARIABLE_NAME_PATTERN,
    MS_VARIABLE_TYPES,
    type MsVariableRow,
    type MsVariableType,
} from "../types/ms-catalog.schema";
import { parseJsonDocument } from "./ms-variables";

const SUPPORTED_TYPES: readonly string[] = MS_VARIABLE_TYPES;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSupportedType(value: unknown): value is MsVariableType {
    return typeof value === "string" && SUPPORTED_TYPES.includes(value);
}

function parseBooleanText(raw: string): boolean | null {
    const lowered = raw.trim().toLowerCase();
    if (lowered === "true" || lowered === "1") return true;
    if (lowered === "false" || lowered === "0") return false;
    return null;
}

export function coerceExampleValue(
    type: MsVariableType | "untyped",
    raw: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
    const trimmed = raw.trim();
    switch (type) {
        case "number": {
            const parsed = Number(trimmed);
            if (!Number.isFinite(parsed)) return { ok: false, error: "must be a number" };
            return { ok: true, value: parsed };
        }
        case "integer": {
            const parsed = Number(trimmed);
            if (!Number.isInteger(parsed)) return { ok: false, error: "must be an integer" };
            return { ok: true, value: parsed };
        }
        case "boolean": {
            const parsed = parseBooleanText(trimmed);
            if (parsed === null) return { ok: false, error: "must be true or false" };
            return { ok: true, value: parsed };
        }
        case "array": {
            let parsed: unknown;
            try {
                parsed = JSON.parse(trimmed) as unknown;
            } catch {
                return { ok: false, error: "must be valid JSON array" };
            }
            if (!Array.isArray(parsed)) return { ok: false, error: "must be a JSON array" };
            return { ok: true, value: parsed };
        }
        case "object": {
            let parsed: unknown;
            try {
                parsed = JSON.parse(trimmed) as unknown;
            } catch {
                return { ok: false, error: "must be valid JSON object" };
            }
            if (!isRecord(parsed)) return { ok: false, error: "must be a JSON object" };
            return { ok: true, value: parsed };
        }
        case "null": {
            if (trimmed.toLowerCase() !== "null") {
                return { ok: false, error: "must be null or left empty" };
            }
            return { ok: true, value: null };
        }
        default:
            return { ok: true, value: trimmed };
    }
}

export function validateVariableRows(rows: readonly MsVariableRow[]): string | null {
    const seen = new Set<string>();
    for (const row of rows) {
        const name = row.name.trim();
        if (name.length === 0) return "Every variable needs a name.";
        if (!MS_VARIABLE_NAME_PATTERN.test(name)) {
            return `Variable “${name}” may only contain letters, digits, dots and underscores.`;
        }
        if (seen.has(name)) return `Variable “${name}” is declared more than once.`;
        seen.add(name);
        if (row.example.trim().length > 0) {
            const coerced = coerceExampleValue(row.type, row.example);
            if (coerced.ok === false) return `Example for “${name}” ${coerced.error}.`;
        }
    }
    return null;
}

export function buildPayloadSchema(rows: readonly MsVariableRow[]): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    for (const row of rows) {
        const name = row.name.trim();
        if (name.length === 0) continue;
        properties[name] = row.type === "untyped" ? {} : { type: row.type };
    }
    return { type: "object", properties };
}

export function buildPayloadExample(rows: readonly MsVariableRow[]): Record<string, unknown> {
    const example: Record<string, unknown> = {};
    for (const row of rows) {
        const name = row.name.trim();
        if (name.length === 0) continue;
        if (row.example.trim().length === 0) continue;
        const coerced = coerceExampleValue(row.type, row.example);
        if (coerced.ok === true) example[name] = coerced.value;
    }
    return example;
}

function exampleToText(value: unknown): string {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
        return String(value);
    }
    if (value === null || value === undefined) return "";
    try {
        return JSON.stringify(value);
    } catch {
        return "";
    }
}

export function parseVariablesFromDocuments(schema: unknown, example: unknown): MsVariableRow[] {
    const names = new Set<string>();
    const typeByName = new Map<string, MsVariableType | "untyped">();
    const schemaDoc = parseJsonDocument(schema);
    if (isRecord(schemaDoc)) {
        const properties = schemaDoc["properties"];
        const source = isRecord(properties) ? properties : schemaDoc;
        const fromProperties = isRecord(properties);
        for (const key of Object.keys(source)) {
            if (key.length === 0 || !MS_VARIABLE_NAME_PATTERN.test(key)) continue;
            names.add(key);
            if (fromProperties) {
                const declared = source[key];
                if (isRecord(declared) && isSupportedType(declared["type"])) {
                    typeByName.set(key, declared["type"]);
                } else {
                    typeByName.set(key, "untyped");
                }
            } else {
                typeByName.set(key, "untyped");
            }
        }
    }
    const exampleDoc = parseJsonDocument(example);
    const exampleByName = new Map<string, string>();
    if (isRecord(exampleDoc)) {
        for (const key of Object.keys(exampleDoc)) {
            if (key.length === 0 || !MS_VARIABLE_NAME_PATTERN.test(key)) continue;
            names.add(key);
            exampleByName.set(key, exampleToText(exampleDoc[key]));
            if (!typeByName.has(key)) typeByName.set(key, "untyped");
        }
    }
    return [...names]
        .sort()
        .map((name) => ({
            name,
            type: typeByName.get(name) ?? "untyped",
            example: exampleByName.get(name) ?? "",
        }));
}
