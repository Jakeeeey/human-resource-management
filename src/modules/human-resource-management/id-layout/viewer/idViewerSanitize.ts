const ALLOWED_VIEWER_INLINE = new Set(["strong", "b", "em", "i", "u", "s", "br", "a"]);

const BLOCK_VIEWER_CLOSE_BREAK = new Set([
    "p",
    "div",
    "li",
    "ul",
    "ol",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "pre",
    "section",
    "article",
    "header",
    "footer",
    "tr",
    "table",
]);

const DROP_VIEWER_WITH_CONTENT = new Set([
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "link",
    "meta",
    "title",
    "head",
    "noscript",
    "template",
    "frame",
    "frameset",
    "applet",
    "base",
]);

const KNOWN_VIEWER_ELEMENT = new Set([
    "a",
    "abbr",
    "acronym",
    "address",
    "area",
    "article",
    "aside",
    "audio",
    "b",
    "basefont",
    "bdi",
    "bdo",
    "big",
    "blink",
    "body",
    "button",
    "canvas",
    "caption",
    "center",
    "cite",
    "code",
    "col",
    "colgroup",
    "data",
    "datalist",
    "dd",
    "del",
    "details",
    "dfn",
    "dialog",
    "div",
    "dl",
    "dt",
    "em",
    "fieldset",
    "figcaption",
    "figure",
    "font",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hgroup",
    "hr",
    "html",
    "i",
    "img",
    "input",
    "ins",
    "kbd",
    "label",
    "legend",
    "li",
    "main",
    "map",
    "mark",
    "marquee",
    "menu",
    "meter",
    "nav",
    "nobr",
    "ol",
    "optgroup",
    "option",
    "output",
    "p",
    "picture",
    "pre",
    "progress",
    "q",
    "rp",
    "rt",
    "ruby",
    "s",
    "samp",
    "search",
    "section",
    "select",
    "slot",
    "small",
    "source",
    "span",
    "strike",
    "strong",
    "sub",
    "summary",
    "sup",
    "table",
    "tbody",
    "td",
    "textarea",
    "tfoot",
    "th",
    "thead",
    "time",
    "tr",
    "track",
    "tt",
    "u",
    "ul",
    "var",
    "video",
    "wbr",
]);

const CLOSE_VIEWER_TAG_PATTERN = /^<\/\s*([A-Za-z][A-Za-z0-9]*)\s*>/;
const COMMENT_VIEWER_PATTERN = /^<!--[\s\S]*?-->/;
const UNCLOSED_COMMENT_VIEWER_PATTERN = /^<!--[\s\S]*$/;
const DECL_VIEWER_PATTERN = /^<![^>]*>/;
const PI_VIEWER_PATTERN = /^<\?[\s\S]*?\?>/;
const OPEN_VIEWER_TAG_PATTERN =
    /^<([A-Za-z][A-Za-z0-9]*)((?:\s+[^\s<>=/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/;
const ATTR_VIEWER_PATTERN =
    /([^\s<>=/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;
const ENTITY_VIEWER_SAFE_PATTERN = /&(?!(?:[A-Za-z]+|#[0-9]+|#[xX][0-9A-Fa-f]+);)/g;
const FONT_VIEWER_WEIGHT_PATTERN =
    /^(normal|bold|bolder|lighter|100|200|300|400|500|600|700|800|900)$/;
const FONT_VIEWER_STYLE_PATTERN = /^(normal|italic|oblique)$/;
const COLOR_VIEWER_HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/;
const COLOR_VIEWER_NAME_PATTERN = /^[a-z]+$/;
const DECORATION_VIEWER_TOKEN_PATTERN = /^(underline|overline|line-through|none)$/;

function escapeViewerTextRun(value: string): string {
    return value
        .replace(ENTITY_VIEWER_SAFE_PATTERN, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function escapeViewerAttrValue(value: string): string {
    return value
        .replace(ENTITY_VIEWER_SAFE_PATTERN, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function stripViewerControls(raw: string): string {
    let out = "";
    for (const ch of raw) {
        if (ch <= " ") continue;
        out += ch;
    }
    return out;
}

function sanitizeViewerStyleValue(raw: string): string | null {
    const kept: string[] = [];
    for (const declaration of raw.split(";")) {
        const colon = declaration.indexOf(":");
        if (colon < 0) continue;
        const prop = declaration.slice(0, colon).trim().toLowerCase();
        const val = declaration.slice(colon + 1).trim().toLowerCase();
        if (val.length === 0) continue;
        if (prop === "font-weight" && FONT_VIEWER_WEIGHT_PATTERN.test(val)) {
            kept.push(`font-weight: ${val}`);
        } else if (prop === "font-style" && FONT_VIEWER_STYLE_PATTERN.test(val)) {
            kept.push(`font-style: ${val}`);
        } else if (prop === "text-decoration") {
            const tokens = val.split(/\s+/).filter((token) => token.length > 0);
            if (
                tokens.length > 0 &&
                tokens.every((token) => DECORATION_VIEWER_TOKEN_PATTERN.test(token))
            ) {
                kept.push(`text-decoration: ${tokens.join(" ")}`);
            }
        } else if (
            prop === "color" &&
            (COLOR_VIEWER_HEX_PATTERN.test(val) || COLOR_VIEWER_NAME_PATTERN.test(val))
        ) {
            kept.push(`color: ${val}`);
        }
    }
    return kept.length > 0 ? kept.join("; ") : null;
}

function sanitizeViewerHref(raw: string): string | null {
    const compact = stripViewerControls(raw);
    if (compact.length === 0) return null;
    const lower = compact.toLowerCase();
    const allowed =
        lower.startsWith("https://") ||
        lower.startsWith("http://") ||
        lower.startsWith("mailto:");
    if (!allowed) return null;
    if (/[<>"` ]/.test(compact)) return null;
    return escapeViewerAttrValue(compact);
}

function sanitizedViewerAttrs(tag: string, attrText: string): string {
    let out = "";
    ATTR_VIEWER_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = ATTR_VIEWER_PATTERN.exec(attrText)) !== null) {
        const name = (match[1] ?? "").toLowerCase();
        const quoted = match[2] ?? "";
        if (tag === "a" && name === "href") {
            const href = sanitizeViewerHref(decodeViewerAttrQuotes(quoted));
            if (href !== null) out += ` href="${href}"`;
        } else if (name === "style") {
            const style = sanitizeViewerStyleValue(decodeViewerAttrQuotes(quoted));
            if (style !== null) out += ` style="${escapeViewerAttrValue(style)}"`;
        }
    }
    return out;
}

function decodeViewerAttrQuotes(quoted: string): string {
    if (quoted.length >= 2) {
        const first = quoted.charAt(0);
        const last = quoted.charAt(quoted.length - 1);
        if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
            return quoted.slice(1, -1);
        }
    }
    return quoted;
}

function dropViewerElementWithContent(
    source: string,
    start: number,
    tag: string,
): number {
    const closeHead = `</${tag}`;
    const openHead = `<${tag}`;
    let depth = 0;
    let cursor = start;
    while (cursor < source.length) {
        const openAt = source.indexOf("<", cursor);
        if (openAt < 0) return source.length;
        const head = source.slice(openAt, openAt + closeHead.length).toLowerCase();
        const after = source.charAt(openAt + closeHead.length);
        if (head === closeHead && (after === "" || /[\s>]/.test(after))) {
            const endAt = source.indexOf(">", openAt + closeHead.length);
            if (endAt < 0) return source.length;
            if (depth === 0) return endAt + 1;
            depth -= 1;
            cursor = endAt + 1;
        } else if (
            source.slice(openAt, openAt + openHead.length).toLowerCase() === openHead &&
            /[\s>/]/.test(source.charAt(openAt + openHead.length) || " ")
        ) {
            depth += 1;
            cursor = openAt + 1;
        } else {
            cursor = openAt + 1;
        }
    }
    return source.length;
}

function sanitizeViewerRichText(input: string): string {
    let out = "";
    let pos = 0;
    while (pos < input.length) {
        const current = input.charAt(pos);
        if (current !== "<") {
            const next = input.indexOf("<", pos);
            const end = next < 0 ? input.length : next;
            out += escapeViewerTextRun(input.slice(pos, end));
            pos = end;
            continue;
        }
        const rest = input.slice(pos);
        if (COMMENT_VIEWER_PATTERN.test(rest)) {
            const end = rest.indexOf("-->") + 3;
            pos += end;
            continue;
        }
        if (UNCLOSED_COMMENT_VIEWER_PATTERN.test(rest)) {
            pos = input.length;
            continue;
        }
        const closeMatch = CLOSE_VIEWER_TAG_PATTERN.exec(rest);
        if (closeMatch) {
            const tag = (closeMatch[1] ?? "").toLowerCase();
            if (tag === "br") {
                if (!out.endsWith("<br>")) out += "<br>";
            } else if (ALLOWED_VIEWER_INLINE.has(tag)) {
                out += `</${tag}>`;
            } else if (BLOCK_VIEWER_CLOSE_BREAK.has(tag)) {
                if (!out.endsWith("<br>")) out += "<br>";
            } else if (!KNOWN_VIEWER_ELEMENT.has(tag)) {
                out += escapeViewerTextRun(closeMatch[0]);
            }
            pos += closeMatch[0].length;
            continue;
        }
        if (DECL_VIEWER_PATTERN.test(rest) || PI_VIEWER_PATTERN.test(rest)) {
            const skipped = DECL_VIEWER_PATTERN.test(rest)
                ? (DECL_VIEWER_PATTERN.exec(rest)?.[0].length ?? 1)
                : (rest.indexOf("?>") + 2);
            pos += skipped;
            continue;
        }
        const openMatch = OPEN_VIEWER_TAG_PATTERN.exec(rest);
        if (!openMatch) {
            out += "&lt;";
            pos += 1;
            continue;
        }
        const tag = (openMatch[1] ?? "").toLowerCase();
        const attrText = openMatch[2] ?? "";
        if (DROP_VIEWER_WITH_CONTENT.has(tag)) {
            pos = dropViewerElementWithContent(input, pos + openMatch[0].length, tag);
            continue;
        } else if (!ALLOWED_VIEWER_INLINE.has(tag) && !KNOWN_VIEWER_ELEMENT.has(tag)) {
            out += escapeViewerTextRun(openMatch[0]);
        } else if (ALLOWED_VIEWER_INLINE.has(tag)) {
            if (tag === "br") {
                if (!out.endsWith("<br>")) out += "<br>";
            } else {
                out += `<${tag}${sanitizedViewerAttrs(tag, attrText)}>`;
            }
        } else if (tag === "img") {
            ATTR_VIEWER_PATTERN.lastIndex = 0;
            let attrMatch: RegExpExecArray | null;
            while ((attrMatch = ATTR_VIEWER_PATTERN.exec(attrText)) !== null) {
                if ((attrMatch[1] ?? "").toLowerCase() === "alt") {
                    const alt = decodeViewerAttrQuotes(attrMatch[2] ?? "").trim();
                    if (alt.length > 0) out += escapeViewerTextRun(alt);
                    break;
                }
            }
        }
        pos += openMatch[0].length;
    }
    return out.replace(/(<br>)+$/g, "");
}

export function sanitizeIdViewerInlineHtml(input: unknown): string {
    if (typeof input !== "string") return "";
    if (input.length === 0) return "";
    try {
        return sanitizeViewerRichText(input);
    } catch {
        return escapeViewerTextRun(input);
    }
}
