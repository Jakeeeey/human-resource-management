// Plaintext converter (Appendix Plaintext row): module-local converter that
// strips tags, maps links to `text (url)`. Used at template save time to
// auto-generate body_text and by dispatch for multipart/alternative.
// Pure + server-safe (string/regex ops only — no DOM).

const LINK_TAG = /<a\s[^>]*href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a\s*>/gi;
const BR_TAG = /<br\s*\/?>/gi;
const BLOCK_CLOSE = /<\/(p|h1|h2|ul|ol|li|div|tr|blockquote)\s*>/gi;
const BLOCK_OPEN_LI = /<(p|h1|h2|ul|ol|li|div|tr|blockquote)[\s>]/gi;
const ANY_TAG = /<[^>]*>/g;

const ENTITIES: Array<[RegExp, string]> = [
    [/&amp;/g, "&"],
    [/&lt;/g, "<"],
    [/&gt;/g, ">"],
    [/&quot;/g, '"'],
    [/&#39;/g, "'"],
    [/&nbsp;/g, " "],
];

function decodeEntities(text: string): string {
    let out = text;
    for (const [pattern, replacement] of ENTITIES) out = out.replace(pattern, replacement);
    return out;
}

/**
 * Converts sanitized HTML to plaintext (links become `text (url)`).
 * @param html - Sanitized HTML (scrubbed before render in the pipeline).
 * @returns Plaintext with one link per `text (url)` mapping.
 */
export function mailHtmlToText(html: string): string {
    if (typeof html !== "string" || html.length === 0) return "";
    const withLinks = html.replace(
        LINK_TAG,
        (_match, _q1: string, dq: string, sq: string, bare: string, label: string) => {
            const url = (dq ?? sq ?? bare ?? "").trim();
            const text = decodeEntities(stripTags(label).trim());
            if (text.length > 0 && url.length > 0) return `${text} (${url})`;
            return text.length > 0 ? text : url;
        }
    );
    const withBreaks = withLinks.replace(BR_TAG, "\n").replace(BLOCK_CLOSE, "\n").replace(BLOCK_OPEN_LI, "\n");
    const stripped = stripTags(withBreaks);
    const decoded = decodeEntities(stripped);
    return decoded
        .split("\n")
        .map((line) => line.replace(/[ \t]+/g, " ").trim())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function stripTags(html: string): string {
    return html.replace(ANY_TAG, "");
}
