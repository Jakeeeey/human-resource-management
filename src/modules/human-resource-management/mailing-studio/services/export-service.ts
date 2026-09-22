// T9 — server-only MJML export compiler. NEVER import this module client-side
// (it pulls in mjml, which is a Node-only dependency).
//
// compileCanvasDoc: canvas doc → MJML → email HTML with honest degradation
// warnings. The canvas stays freeform at rest (Option 1); export flattens
// rotation / overlap / stage-overflow honestly and reports each degradation
// as a parseable "reason:{id} detail" warning for the outbox (T3/T10).
import mjml2html from "mjml";

import { type CanvasDoc, type CanvasNode } from "../types/canvas-doc.schema";
import {
    bucketRows,
    childrenOf,
    columnWidthPercent,
    findOverlaps,
    flattenDisplayOrder,
    isClipped,
    rootsOf,
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

/**
 * MJML content for one node. Boxes render their children as nested flow
 * INSIDE the box column (a nested box's children flatten one level further —
 * MJML forbids columns inside columns).
 */
function contentOf(doc: CanvasDoc, node: CanvasNode): string {
    switch (node.type) {
        case "text":
            return `<mj-text>${escapeText(stringProp(node, "text"))}</mj-text>`;
        case "image": {
            const width = numberPxProp(node, "width");
            const height = numberPxProp(node, "height");
            return (
                `<mj-image src="${escapeAttr(stringProp(node, "src"))}"` +
                ` alt="${escapeAttr(stringProp(node, "alt"))}"` +
                (width ? ` width="${width}"` : "") +
                (height ? ` height="${height}"` : "") +
                " />"
            );
        }
        case "button": {
            // P0-2: editor/chips write props.text (PropertyPanel Label → updateProps
            // { text }); fall back to props.label for legacy docs.
            const label = stringProp(node, "text") || stringProp(node, "label");
            return (
                `<mj-button href="${escapeAttr(stringProp(node, "href"))}">` +
                `${escapeText(label)}</mj-button>`
            );
        }
        case "divider":
            return "<mj-divider />";
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
 *  (d) row → mj-section, node → mj-column (width = w/600%, min 20%),
 *      node content → mj-text / mj-image / mj-button / mj-divider / mj-spacer;
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

    // (d) rows → sections, nodes → columns.
    const sections = rows
        .map(
            (row) =>
                `<mj-section>${row
                    .map(
                        (node) =>
                            `<mj-column width="${columnWidthPercent(node)}">` +
                            `${contentOf(doc, node)}</mj-column>`,
                    )
                    .join("")}</mj-section>`,
        )
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
