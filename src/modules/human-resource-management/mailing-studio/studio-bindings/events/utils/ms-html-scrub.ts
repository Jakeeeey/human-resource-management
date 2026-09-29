// T3 — server re-assert predicates (READ-ONLY copy of recruitment/mailing
// utils/mailScrub.ts server half; exports renamed ms*). Canvas-compiled HTML
// is final (no {{var}} renderer), so the dispatch pipeline only re-asserts
// stored/exported HTML against the frozen forbidden-tag rules below.
// Pure string checks — no DOM, safe in Node.

import { MS_BODY_HTML_MAX } from "../types/ms-template.schema";

// Server re-assert predicates (byte-copy of old mailScrub.ts — Appendix Scrub row).
const SCRIPT_TAG = /<script[\s>]/i;
const EVENT_HANDLER_ATTR = /\son\w+\s*=/i;
const JAVASCRIPT_URI = /javascript:/i;

/**
 * Server-safe predicate: true when stored HTML trips any rejection rule
 * (script tag, event-handler attr, javascript: URI, over the length cap).
 * @param html - Stored/exported HTML to re-assert.
 * @returns True when the HTML must be rejected.
 */
export function msHasForbiddenMailHtml(html: string): boolean {
    if (typeof html !== "string") return true;
    if (html.length > MS_BODY_HTML_MAX) return true;
    return SCRIPT_TAG.test(html) || EVENT_HANDLER_ATTR.test(html) || JAVASCRIPT_URI.test(html);
}

/**
 * Server-safe re-assert: returns null when clean, else a short reason.
 * @param html - Stored/exported HTML to re-assert.
 * @returns Null when acceptable, otherwise the rejection reason.
 */
export function msAssertMailableHtml(html: string): string | null {
    if (typeof html !== "string" || html.length === 0) return "Body is required";
    if (html.length > MS_BODY_HTML_MAX) return `Body must be at most ${MS_BODY_HTML_MAX} characters`;
    if (SCRIPT_TAG.test(html)) return "Body must not contain script tags";
    if (EVENT_HANDLER_ATTR.test(html)) return "Body must not contain event handlers";
    if (JAVASCRIPT_URI.test(html)) return "Body must not contain javascript: URIs";
    return null;
}
