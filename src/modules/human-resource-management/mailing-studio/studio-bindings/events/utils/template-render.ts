// Mailing Studio — open-substitution renderer (P4-T2, D3). Substitutes
// `{{tokens}}` in template subject/body against the emit payload at send.
// Canonical stored form is the bare key (`{{user_name}}`); the explicit
// `{{payload.user_name}}` spelling is accepted and normalised to the same
// result. The token name IS the payload key (§7.7) — no rename layer.
// `payload` is the only value root. Pure + server-safe; never throws.
//
// Highest-severity rule (§10): EVERY substituted value is HTML-escaped
// (`& < > "`) — an unescaped payload value is an injection into an email.
// Unknown path ⇒ "" + `unknown-var:<path>` warning. A key present on the
// payload object but holding null/undefined renders "" silently
// (missing-but-known). A resolved value over 4096 chars is truncated +
// `value-truncated:<path>` (§7.6).

/** Render context — `payload` is the only value root, by design (§7.7). */
export interface RenderContext {
    payload: Record<string, unknown>;
}

/** Renderer output: substituted text plus per-token warnings. */
export interface RenderResult {
    html: string;
    warnings: string[];
}

/** Per-value cap (§7.6): longer resolutions are truncated + warned. */
export const MS_RENDER_VALUE_MAX = 4096;

const TOKEN_PATTERN = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;

const PAYLOAD_PREFIX = "payload.";

/**
 * Normalises one raw token path to the canonical bare form (§6.4): the
 * explicit `{{payload.user_name}}` spelling collapses to `user_name`, which
 * is what the compiler stores in ms_templates.variables. The token name IS
 * the payload key (§7.7) — no rename layer.
 */
export function normaliseTokenPath(path: string): string {
    const trimmed = path.trim();
    if (trimmed.startsWith(PAYLOAD_PREFIX)) {
        return trimmed.slice(PAYLOAD_PREFIX.length);
    }
    return trimmed;
}

/**
 * Scans text for the distinct `{{ key }}` tokens, normalised to the bare
 * canonical form and sorted. Both `{{key}}` and `{{payload.key}}` spellings
 * collapse to `key`. Empty results (e.g. `{{payload}}` alone) are dropped.
 */
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

/**
 * HTML-escapes one substituted value (& < > "). Ampersand first so existing
 * entities are not double-built.
 */
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

/**
 * Resolves one bare token path against the payload. A `payload.` prefix is
 * stripped first so both spellings land identically.
 */
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

/**
 * Renders `{{tokens}}` in text against the payload, escaping every value.
 * @param text - Template subject or body_html carrying `{{tokens}}`.
 * @param ctx - Render context (payload root).
 * @returns Substituted text + warnings (`unknown-var:*`, `value-truncated:*`).
 */
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
