import { extractTemplateTokens } from "./template-render";

export const MS_VARIABLES_MAX = 200;

const TOKEN_KEY_PATTERN = /^[A-Za-z0-9_.]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function compileVariablesFromDesignJson(design_json: string): string[] {
    return extractTemplateTokens(design_json).slice(0, MS_VARIABLES_MAX);
}

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

export function extractPayloadExample(example: unknown): Record<string, unknown> {
    const doc = parseJsonDocument(example);
    return isRecord(doc) ? doc : {};
}

export interface TokenClassification {
    provided: string[];
    unmapped: string[];
}

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

export function normaliseVariablesList(value: unknown): string[] {
    const doc = parseJsonDocument(value);
    if (!Array.isArray(doc)) return [];
    return doc
        .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
        .sort();
}
