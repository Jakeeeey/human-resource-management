import { mailVarAllowlist } from "../types/mail-template.schema";

// {{var}} substitution against the frozen allowlist (Appendix Renderer row).
//
// Pure + server-safe (string ops only — no DOM). Pipeline order is
// scrub-before-render: scrub utils run first on the raw template, then this
// renderer substitutes vars, so {{var}} tokens pass through the scrub as
// plain text (see mailScrub.ts).
//
// Send-time rule (both docs agree): an allowlisted var missing from `vars`
// renders as "" silently; a NON-allowlisted (unknown) var renders as "" AND
// appends `unknown-var:<name>` to warnings (persisted on the outbox row and
// shown inline in preview). Preview sample blanks render `____` cosmetically
// at the UI layer only — never here.

const ALLOWLIST = new Set<string>(mailVarAllowlist as readonly string[]);

const VAR_TOKEN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

export interface RenderMailResult {
    /** Rendered text with tokens substituted. */
    text: string;
    /** `unknown-var:<name>` entries in first-seen order (deduplicated). */
    warnings: string[];
}

export interface RenderMailOptions {
    /** Wraps non-empty substituted values in `<strong>` (body renders only —
     * subjects must never pass this: email subjects carry no HTML). */
    boldVars?: boolean;
}

function escapeMailVarValue(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Substitutes {{var}} tokens against the frozen allowlist.
 * @param template - Subject or body carrying {{var}} tokens.
 * @param vars - Per-send variable values (e.g. applicant_name, position).
 * @param options - `{ boldVars: true }` escapes + bolds substituted values
 * (body HTML only — plaintext-safe: mailHtmlToText decodes the entities).
 * @returns The rendered text plus unknown-var warnings.
 */
export function renderMailTemplate(
    template: string,
    vars: Record<string, string>,
    options?: RenderMailOptions
): RenderMailResult {
    if (typeof template !== "string" || template.length === 0) {
        return { text: template ?? "", warnings: [] };
    }
    const boldVars = options?.boldVars === true;
    const seen = new Set<string>();
    const warnings: string[] = [];
    const text = template.replace(VAR_TOKEN, (_match, name: string) => {
        if (ALLOWLIST.has(name)) {
            const value = vars[name];
            if (typeof value !== "string" || value.length === 0) return "";
            return boldVars ? `<strong>${escapeMailVarValue(value)}</strong>` : value;
        }
        if (!seen.has(name)) {
            seen.add(name);
            warnings.push(`unknown-var:${name}`);
        }
        return "";
    });
    return { text, warnings };
}

/**
 * Returns true when a var name is in the frozen renderer allowlist.
 * @param name - Bare var name without braces.
 * @returns True when the renderer would substitute it.
 */
export function isAllowedMailVar(name: string): boolean {
    return ALLOWLIST.has(name);
}
