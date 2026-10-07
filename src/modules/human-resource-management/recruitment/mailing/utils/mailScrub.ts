// HTML scrub split (Appendix Scrub row).
//
// "use client"-ADJACENT DESIGN (no "use client" directive on purpose): this
// file is importable server-side for the pure string predicates below, while
// scrubClientHtml() is CLIENT-ONLY — it uses DOMParser and throws a clear
// error under Node. Server re-assert stays string predicates only (no DOM in
// Node); the client save path runs scrubClientHtml() before POST.
//
// Pipeline order is scrub-before-render, so {{var}} tokens reach the scrubber
// as plain text nodes and survive verbatim (proven by vector V7).

import { MAIL_BODY_HTML_MAX } from "../types/mail-template.schema";

// Allowlist (Appendix Scrub row): tags p,strong,em,u,s,ul,ol,li,a,h1,h2,br;
// attrs href only — NO class/style (kills quill ql-* classes + inline-style
// smuggling). Event handlers + javascript: URIs are stripped.
const ALLOWED_TAGS = new Set([
    "p",
    "strong",
    "em",
    "u",
    "s",
    "ul",
    "ol",
    "li",
    "a",
    "h1",
    "h2",
    "br",
]);

// Tags whose whole subtree is dropped (no unwrapping — content untrusted).
const DROP_SUBTREE = new Set(["script", "style", "img", "iframe", "object", "embed"]);

// Server re-assert predicates (pure string checks, no DOM — safe in Node).
const SCRIPT_TAG = /<script[\s>]/i;
const EVENT_HANDLER_ATTR = /\son\w+\s*=/i;
const JAVASCRIPT_URI = /javascript:/i;

/**
 * CLIENT-ONLY: scrubs editor HTML through a DOMParser allowlist. Throws a
 * clear error when called where no DOM exists (Node/server).
 * @param html - Raw editor HTML (may carry {{var}} tokens as text).
 * @returns Sanitized HTML containing allowlisted tags/attrs only.
 */
export function scrubClientHtml(html: string): string {
    if (typeof DOMParser === "undefined") {
        throw new Error(
            "scrubClientHtml requires a browser DOM (DOMParser unavailable server-side). " +
                "Use hasForbiddenMailHtml()/assertMailableHtml() for the server re-assert."
        );
    }
    if (typeof html !== "string" || html.length === 0) return "";
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    const root = doc.body.firstElementChild;
    if (!root) return "";
    sanitizeNode(root);
    return root.innerHTML;
}

function sanitizeNode(parent: Element): void {
    for (const child of Array.from(parent.childNodes)) {
        if (child.nodeType === 8) {
            parent.removeChild(child);
            continue;
        }
        if (child.nodeType !== 1) continue; // text node: kept verbatim ({{var}} tokens survive here)
        const el = child as Element;
        const tag = el.tagName.toLowerCase();
        if (DROP_SUBTREE.has(tag) || tag === "script") {
            parent.removeChild(el);
            continue;
        }
        if (!ALLOWED_TAGS.has(tag)) {
            // Unknown/formatting wrapper (div, span, font...): unwrap children.
            sanitizeNode(el);
            while (el.firstChild) parent.insertBefore(el.firstChild, el);
            parent.removeChild(el);
            continue;
        }
        // Allowlisted tag: keep href on <a> only when it is not a javascript: URI.
        for (const attr of Array.from(el.attributes)) {
            const name = attr.name.toLowerCase();
            if (tag === "a" && name === "href" && !JAVASCRIPT_URI.test(attr.value)) {
                continue;
            }
            el.removeAttribute(attr.name);
        }
        sanitizeNode(el);
    }
    // Drop stray comment nodes.
    for (const child of Array.from(parent.childNodes)) {
        if (child.nodeType === 8) parent.removeChild(child);
    }
}

/**
 * Server-safe predicate: true when stored HTML trips any rejection rule
 * (script tag, event-handler attr, javascript: URI, over the length cap).
 * @param html - Stored/sanitized HTML to re-assert.
 * @returns True when the HTML must be rejected.
 */
export function hasForbiddenMailHtml(html: string): boolean {
    if (typeof html !== "string") return true;
    if (html.length > MAIL_BODY_HTML_MAX) return true;
    return SCRIPT_TAG.test(html) || EVENT_HANDLER_ATTR.test(html) || JAVASCRIPT_URI.test(html);
}

/**
 * Server-safe re-assert: returns null when clean, else a short reason.
 * @param html - Stored/sanitized HTML to re-assert.
 * @returns Null when acceptable, otherwise the rejection reason.
 */
export function assertMailableHtml(html: string): string | null {
    if (typeof html !== "string" || html.length === 0) return "Body is required";
    if (html.length > MAIL_BODY_HTML_MAX) return `Body must be at most ${MAIL_BODY_HTML_MAX} characters`;
    if (SCRIPT_TAG.test(html)) return "Body must not contain script tags";
    if (EVENT_HANDLER_ATTR.test(html)) return "Body must not contain event handlers";
    if (JAVASCRIPT_URI.test(html)) return "Body must not contain javascript: URIs";
    return null;
}
