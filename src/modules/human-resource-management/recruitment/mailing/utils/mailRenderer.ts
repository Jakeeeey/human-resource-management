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

/**
 * Substitutes {{var}} tokens against the frozen allowlist.
 * @param template - Subject or body carrying {{var}} tokens.
 * @param vars - Per-send variable values (e.g. applicant_name, position).
 * @returns The rendered text plus unknown-var warnings.
 */
export function renderMailTemplate(
    template: string,
    vars: Record<string, string>
): RenderMailResult {
    if (typeof template !== "string" || template.length === 0) {
        return { text: template ?? "", warnings: [] };
    }
    const seen = new Set<string>();
    const warnings: string[] = [];
    const text = template.replace(VAR_TOKEN, (_match, name: string) => {
        if (ALLOWLIST.has(name)) {
            const value = vars[name];
            return typeof value === "string" ? value : "";
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
