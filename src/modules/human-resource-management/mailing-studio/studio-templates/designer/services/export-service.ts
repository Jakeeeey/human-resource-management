// T9 — server-only MJML export compiler. NEVER import this module client-side
// (it pulls in mjml, which is a Node-only dependency).
//
// compileCanvasDoc: canvas doc → MJML → email HTML with honest degradation
// warnings. The canvas stays freeform at rest (Option 1); export flattens
// rotation / overlap / stage-overflow honestly and reports each degradation
// as a parseable "reason:{id} detail" warning for the outbox (T3/T10).
import mjml2html from "mjml";

import {
    blockPaddingFallback,
    resolveStyleValue,
    type CanvasDoc,
    type CanvasNode,
} from "../types/canvas-doc.schema";
import {
    bucketRows,
    buttonSizePadding,
    childrenOf,
    columnSpanPercent,
    findOverlaps,
    flattenDisplayOrder,
    isClipped,
    leadingGaps,
    rowTop,
    rootsOf,
    verticalGap,
} from "./export-layout";

export interface ExportResult {
    mjml: string;
    html: string;
    warnings: string[];
}

export interface ExportOptions {
    /** Becomes the document <title> (email subject). */
    subject?: string;
}

const STAGE_WIDTH = 600;

function escapeText(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
    return escapeText(value).replace(/"/g, "&quot;");
}

function stringProp(node: CanvasNode, key: string): string {
    const value = node.props[key];
    return typeof value === "string" ? value : "";
}

function numberPxProp(node: CanvasNode, key: string): string | undefined {
    const value = node.props[key];
    return typeof value === "number" && Number.isFinite(value) ? `${value}px` : undefined;
}

// Fidelity-contract style readers — every key resolves props → theme
// default (shared `resolveStyleValue`), so export emits exactly what the
// canvas renders, including for pre-style docs with no style keys.
function styleTextProp(node: CanvasNode, key: string): string | undefined {
    const value = resolveStyleValue(node.type, node.props, key);
    return typeof value === "string" ? value : undefined;
}

function stylePxProp(node: CanvasNode, key: string): string | undefined {
    const value = resolveStyleValue(node.type, node.props, key);
    return typeof value === "number" ? `${value}px` : undefined;
}

function styleAlignProp(node: CanvasNode): string | undefined {
    const value = resolveStyleValue(node.type, node.props, "align");
    return typeof value === "string" ? value : undefined;
}

function styleBorderProp(node: CanvasNode): string | undefined {
    const width = resolveStyleValue(node.type, node.props, "borderWidth");
    if (typeof width !== "number" || width <= 0) return undefined;
    const color = styleTextProp(node, "borderColor") ?? "#d1d5db";
    return `${width}px solid ${color}`;
}

/** Padding the canvas always renders (class-level) must be explicit — MJML defaults differ. */
function stylePaddingProp(node: CanvasNode): string | undefined {
    return stylePxProp(node, "padding") ?? blockPaddingFallback(node.type);
}

/** mj-text attributes. This MJML version has no border/border-radius on
 * mj-text (illegal — dropped on compile) and ignores background-color, so
 * the fill travels as container-background-color (same td fill the canvas
 * shows) and border/radius are omitted rather than silently dropped. */
function textStyleAttrs(node: CanvasNode): string {
    const parts: string[] = [];
    const color = styleTextProp(node, "color");
    if (color) parts.push(` color="${escapeAttr(color)}"`);
    const fontSize = stylePxProp(node, "fontSize");
    if (fontSize) parts.push(` font-size="${fontSize}"`);
    const fontFamily = styleTextProp(node, "fontFamily");
    if (fontFamily) parts.push(` font-family="${escapeAttr(fontFamily)}"`);
    const align = styleAlignProp(node);
    if (align) parts.push(` align="${align}"`);
    const background = styleTextProp(node, "background");
    if (background) parts.push(` container-background-color="${escapeAttr(background)}"`);
    const padding = stylePaddingProp(node);
    if (padding) parts.push(` padding="${padding}"`);
    return parts.join("");
}

/** mj-button attributes — the full box model is legal here. Padding carries
 * the canvas h: mj-button has no width/height attrs, and its visible anchor
 * sizes from `inner-padding` (outer `padding` only insets the button inside
 * its column). The column content box already equals the canvas w (span
 * tiling), so horizontal inner-padding only centers the label — clamped
 * below half-width so text can never wrap letter-by-letter. Export pins
 * outer padding 0; an explicit `padding` prop still wins. */
function buttonStyleAttrs(node: CanvasNode): string {
    const parts: string[] = [];
    const color = styleTextProp(node, "color");
    if (color) parts.push(` color="${escapeAttr(color)}"`);
    const fontSize = stylePxProp(node, "fontSize");
    if (fontSize) parts.push(` font-size="${fontSize}"`);
    const fontFamily = styleTextProp(node, "fontFamily");
    if (fontFamily) parts.push(` font-family="${escapeAttr(fontFamily)}"`);
    const align = styleAlignProp(node);
    if (align) parts.push(` align="${align}"`);
    const background = styleTextProp(node, "background");
    if (background) parts.push(` background-color="${escapeAttr(background)}"`);
    const hasExplicitPadding =
        typeof node.props["padding"] === "number" &&
        Number.isFinite(node.props["padding"]) &&
        (node.props["padding"] as number) >= 0;
    const innerPadding = hasExplicitPadding ? stylePaddingProp(node) : buttonSizePadding(node);
    parts.push(` padding="0px"`);
    if (innerPadding) parts.push(` inner-padding="${innerPadding}"`);
    const border = styleBorderProp(node);
    if (border) parts.push(` border="${escapeAttr(border)}"`);
    const radius = stylePxProp(node, "radius");
    if (radius) parts.push(` border-radius="${radius}"`);
    return parts.join("");
}

/** Box-model attributes for mj-column (box shells). A positive in-row
 * leading x-gap folds into the left side of the resolved padding shorthand
 * (inner spacing preserved, canvas offset added); with no resolvable padding
 * it falls back to padding-left so the offset still survives export. */
function columnStyleAttrs(node: CanvasNode, leadingGap = 0): string {
    const parts: string[] = [];
    const background = styleTextProp(node, "background");
    if (background) parts.push(` background-color="${escapeAttr(background)}"`);
    const padValue = resolveStyleValue(node.type, node.props, "padding");
    if (leadingGap > 0 && typeof padValue === "number") {
        parts.push(` padding="${padValue}px ${padValue}px ${padValue}px ${padValue + leadingGap}px"`);
    } else {
        const padding = stylePaddingProp(node);
        if (padding) parts.push(` padding="${padding}"`);
        if (leadingGap > 0) parts.push(` padding-left="${leadingGap}px"`);
    }
    const border = styleBorderProp(node);
    if (border) parts.push(` border="${escapeAttr(border)}"`);
    const radius = stylePxProp(node, "radius");
    if (radius) parts.push(` border-radius="${radius}"`);
    return parts.join("");
}

/**
 * MJML content for one node. Boxes render their children as nested flow
 * INSIDE the box column (a nested box's children flatten one level further —
 * MJML forbids columns inside columns).
 */
function contentOf(doc: CanvasDoc, node: CanvasNode): string {
    switch (node.type) {
        case "text":
            return `<mj-text${textStyleAttrs(node)}>${escapeText(stringProp(node, "text"))}</mj-text>`;
        case "image": {
            const width = numberPxProp(node, "width");
            const height = numberPxProp(node, "height");
            const align = styleAlignProp(node);
            const background = styleTextProp(node, "background");
            const padding = stylePaddingProp(node);
            const border = styleBorderProp(node);
            const radius = stylePxProp(node, "radius");
            return (
                `<mj-image src="${escapeAttr(stringProp(node, "src"))}"` +
                ` alt="${escapeAttr(stringProp(node, "alt"))}"` +
                (width ? ` width="${width}"` : "") +
                (height ? ` height="${height}"` : "") +
                (align ? ` align="${align}"` : "") +
                (background ? ` container-background-color="${escapeAttr(background)}"` : "") +
                (padding ? ` padding="${padding}"` : "") +
                (border ? ` border="${escapeAttr(border)}"` : "") +
                (radius ? ` border-radius="${radius}"` : "") +
                " />"
            );
        }
        case "button": {
            // P0-2: editor/chips write props.text (PropertyPanel Label → updateProps
            // { text }); fall back to props.label for legacy docs.
            const label = stringProp(node, "text") || stringProp(node, "label");
            const href = stringProp(node, "href");
            return (
                `<mj-button${buttonStyleAttrs(node)}` +
                (href ? ` href="${escapeAttr(href)}"` : "") +
                `>` +
                `${escapeText(label)}</mj-button>`
            );
        }
        case "divider": {
            const borderColor = styleTextProp(node, "borderColor") ?? styleTextProp(node, "color");
            const borderWidth = stylePxProp(node, "borderWidth");
            const padding = stylePaddingProp(node);
            return (
                "<mj-divider" +
                (borderColor ? ` border-color="${escapeAttr(borderColor)}"` : "") +
                (borderWidth ? ` border-width="${borderWidth}"` : "") +
                (padding ? ` padding="${padding}"` : "") +
                " />"
            );
        }
        case "spacer":
            return `<mj-spacer height="${node.h}px" />`;
        case "box":
            return childrenOf(doc, node.id)
                .map((child) => contentOf(doc, child))
                .join("");
        default:
            return "";
    }
}

/**
 * Canvas doc → MJML → email HTML.
 *
 * Algorithm (T9 plan):
 *  (a) roots (plus box children flattened in parent order) → display order
 *  (b) y-bucket roots into rows (±8px y-center tolerance)
 *  (c) sort each row by x
 *  (d) row → mj-section (padding-top = top offset / inter-row gap,
 *      padding-bottom 0), node → mj-column (width = w/600%, min 20%,
 *      padding-left = in-row leading x-gap),
 *      node content → mj-text / mj-image / mj-button (inner-padding fills
 *      canvas w/h when no explicit padding prop, outer padding 0) /
 *      mj-divider / mj-spacer;
 *      box children render inside the box column as nested flow
 *  (e) honest degradation warnings: rotated / overlap / clipped
 *  (f) mjml root + optional mj-head title + mj-body width=600
 *  (g) mjml2html(soft, minify, no comments) — no variable/token logic
 *
 * Warning format: `reason:{id} detail` (parseable by outbox JSON in T3/T10).
 * Throws Error("empty-canvas") when the doc has no stage roots.
 */
export async function compileCanvasDoc(
    doc: CanvasDoc,
    opts?: ExportOptions,
): Promise<ExportResult> {
    const roots = rootsOf(doc);
    if (roots.length === 0) {
        throw new Error("empty-canvas");
    }

    const displayOrder = flattenDisplayOrder(doc);
    const rows = bucketRows(roots);
    const warnings: string[] = [];

    // (e) rotation ≠ 0 → flattened to 0deg (MJML has no rotation primitive).
    for (const node of displayOrder) {
        if (node.rotation !== 0) {
            warnings.push(`rotated:${node.id} flattened to 0deg`);
        }
    }

    // (e) http:// image src loads on canvas but risks mixed-content blocking
    // in external inboxes — warn, don't block (schema already gates schemes).
    for (const node of displayOrder) {
        if (node.type !== "image") continue;
        const src = node.props.src;
        if (typeof src === "string" && src.toLowerCase().startsWith("http://")) {
            warnings.push(`http-image:${node.id} non-https src may block in external inboxes`);
        }
    }

    // (e) bbox overlap after y-bucketing → unstacked (flow order wins).
    for (const id of findOverlaps(rows)) {
        warnings.push(`overlap:${id} unstacked`);
    }

    // (e) stage overflow → clamped (column width uses the clamped extent).
    for (const node of roots) {
        if (isClipped(node)) {
            warnings.push(`clipped:${node.id} clamped to stage`);
        }
    }

    // (d) rows → sections, nodes → columns (box shells carry their style on
    // the column; box children render as nested flow inside it). Canvas
    // spacing survives exactly: each section pins padding-bottom 0 and takes
    // padding-top = first-row top offset / inter-row gap, while each column
    // takes padding-left = its in-row leading x-gap (MJML defaults would
    // otherwise substitute a fixed 20px rhythm and drop x-offsets).
    const sections = rows
        .map((row, rowIndex) => {
            const top = rowIndex === 0 ? Math.max(0, rowTop(row)) : verticalGap(rows[rowIndex - 1], row);
            const gaps = leadingGaps(row);
            // Row cursor mirrors the leadingGaps traversal so each column span
            // covers prevEnd..x+w (padding-left eats inside the span).
            let prevEnd = 0;
            return (
                `<mj-section padding-bottom="0px" padding-top="${top}px" text-align="left">${row
                    .map((node, nodeIndex) => {
                        const gap = gaps[nodeIndex] ?? 0;
                        const span = columnSpanPercent(node, prevEnd);
                        prevEnd = Math.max(prevEnd, node.x + node.w);
                        const columnExtra =
                            node.type === "box"
                                ? columnStyleAttrs(node, gap)
                                : gap > 0
                                  ? ` padding-left="${gap}px"`
                                  : "";
                        return (
                            `<mj-column width="${span}"${columnExtra}>` +
                            `${contentOf(doc, node)}</mj-column>`
                        );
                    })
                    .join("")}</mj-section>`
            );
        })
        .join("");

    // (f) template wrap: mj-head title (subject) + mj-body width=600.
    const head = opts?.subject
        ? `<mj-head><mj-title>${escapeText(opts.subject)}</mj-title></mj-head>`
        : "";
    const mjml =
        `<mjml>${head}` +
        `<mj-body width="${STAGE_WIDTH}">${sections}</mj-body>` +
        `</mjml>`;

    // (g) soft validation keeps renderable docs flowing; minified, no comments.
    const { html } = await mjml2html(mjml, {
        validationLevel: "soft",
        minify: true,
        keepComments: false,
    });

    return { mjml, html, warnings };
}
