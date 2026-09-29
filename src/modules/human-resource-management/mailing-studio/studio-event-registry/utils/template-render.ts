export interface RenderContext {
    payload: Record<string, unknown>;
}

export interface RenderResult {
    html: string;
    warnings: string[];
}

export const MS_RENDER_VALUE_MAX = 4096;

const TOKEN_PATTERN = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;

const PAYLOAD_PREFIX = "payload.";

export function normaliseTokenPath(path: string): string {
    const trimmed = path.trim();
    if (trimmed.startsWith(PAYLOAD_PREFIX)) {
        return trimmed.slice(PAYLOAD_PREFIX.length);
    }
    return trimmed;
}

export function extractTemplateTokens(text: string): string[] {
    const found = new Set<string>();
    TOKEN_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TOKEN_PATTERN.exec(text)) !== null) {
        const bare = normaliseTokenPath(match[1] ?? "");
        if (bare.length > 0) found.add(bare);
    }
    return [...found].sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function escapeRenderValue(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

interface ResolvedToken {
    found: boolean;
    known: boolean;
    value: string;
}

function resolveTokenPath(path: string, payload: Record<string, unknown>): ResolvedToken {
    const bare = path.startsWith("payload.") ? path.slice("payload.".length) : path;
    if (bare.length === 0) return { found: false, known: false, value: "" };
    const segments = bare.split(".");
    let current: unknown = payload;
    for (const segment of segments) {
        if (segment.length === 0 || !isRecord(current)) {
            return { found: false, known: false, value: "" };
        }
        if (!(segment in current)) {
            return { found: false, known: false, value: "" };
        }
        current = current[segment];
    }
    if (current === undefined || current === null) {
        return { found: false, known: true, value: "" };
    }
    if (typeof current === "string") {
        return { found: true, known: true, value: current };
    }
    if (
        typeof current === "number" ||
        typeof current === "boolean" ||
        typeof current === "bigint"
    ) {
        return { found: true, known: true, value: String(current) };
    }
    return { found: false, known: true, value: "" };
}

export function renderTemplate(text: string, ctx: RenderContext): RenderResult {
    const warnings: string[] = [];
    const payload = isRecord(ctx?.payload) ? ctx.payload : {};
    const html = text.replace(TOKEN_PATTERN, (_match, path: string) => {
        const resolved = resolveTokenPath(path, payload);
        if (!resolved.found && !resolved.known) {
            warnings.push(`unknown-var:${path}`);
            return "";
        }
        if (!resolved.found) {
            return "";
        }
        let value = resolved.value;
        if (value.length > MS_RENDER_VALUE_MAX) {
            warnings.push(`value-truncated:${path}`);
            value = value.slice(0, MS_RENDER_VALUE_MAX);
        }
        return escapeRenderValue(value);
    });
    return { html, warnings };
}
