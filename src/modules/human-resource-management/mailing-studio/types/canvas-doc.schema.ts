import { z } from "zod";

// Canvas doc contract (greenfield — T2 plan). Rotation and overlap are ALLOWED at
// rest; export-time rendering degrades them later (T9). Validation caps below are
// hard rejects at parse time.
export const CANVAS_WIDTH = 600;
export const CANVAS_MAX_NODES = 200;
export const CANVAS_TEXT_MAX = 5_000;

const CANVAS_STAGE_PARENT = "stage";

export const canvasNodeTypeSchema = z.enum([
    "text",
    "image",
    "button",
    "divider",
    "spacer",
    "box",
]);

export type CanvasNodeType = z.infer<typeof canvasNodeTypeSchema>;

// P1-1 block style system — optional style props persisted per node in
// `props`. Every key is optional so docs written before P1-1 (no style keys)
// still parse unchanged (backwards-compatible). Known keys are validated
// lightly when present; unknown props keys stay free-form.
export const blockAlignSchema = z.enum(["left", "center", "right"]);

export type BlockAlign = z.infer<typeof blockAlignSchema>;

export const blockStylePropsSchema = z.object({
    /** Text color (text/button) or line color (divider). */
    color: z.string().min(1).optional(),
    /** Text size in px (text/button). */
    fontSize: z.number().finite().positive().optional(),
    /** Font stack (text/button) — email-safe stacks, e.g. Arial/Georgia. */
    fontFamily: z.string().min(1).optional(),
    /** Fill behind the block (text/button/image/box). */
    background: z.string().min(1).optional(),
    /** Horizontal alignment (text/button/image). */
    align: blockAlignSchema.optional(),
    /** Inner spacing in px (text/button/image/box/divider). */
    padding: z.number().finite().min(0).optional(),
    /** Border thickness in px (text/button/image/box/divider). */
    borderWidth: z.number().finite().min(0).optional(),
    /** Border color (text/button/image/box/divider). */
    borderColor: z.string().min(1).optional(),
    /** Corner radius in px (text/button/image/box). */
    radius: z.number().finite().min(0).optional(),
});

export type BlockStyleProps = z.infer<typeof blockStylePropsSchema>;

// NOTE (DESIGN.md no-hex rule): the hex literals below are EMAIL PAYLOAD data —
// persisted into design_json and compiled to MJML attributes — not UI chrome.
// Chrome tokens still come from globals.css / Tailwind utilities only.
const BASE_STYLE: Record<string, unknown> = {
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: 14,
};

/**
 * Template-level theme defaults for NEW blocks (P1-1). Chip inserts spread
 * these into props so every block starts on-theme; per-block edits override.
 */
export function defaultBlockProps(type: CanvasNodeType): Record<string, unknown> {
    switch (type) {
        case "text":
            return {
                ...BASE_STYLE,
                color: "#1f2937",
                align: "left",
            };
        case "button":
            return {
                ...BASE_STYLE,
                color: "#ffffff",
                background: "#2563eb",
                align: "center",
                radius: 6,
            };
        case "image":
            return { align: "center" };
        case "divider":
            return { borderColor: "#d1d5db", borderWidth: 1 };
        case "box":
            return { background: "#f9fafb", padding: 12, radius: 6 };
        case "spacer":
            return {};
    }
}

/**
 * Shared canvas↔export style resolution (fidelity contract).
 *
 * Both renderers must agree on every style prop: the canvas
 * (`CanvasNodeView.blockStyle`) and the export compiler
 * (`export-service` MJML attrs) resolve through this helper, so a resolved
 * value renders identically on both sides BY CONSTRUCTION.
 *
 * Resolution order per key: valid `props` value wins; otherwise the
 * type's `defaultBlockProps` theme value; otherwise `undefined` (renderer
 * default applies — padded by `blockPaddingFallback` where the canvas has
 * a class-level padding).
 */
export function resolveStyleValue(
    type: CanvasNodeType,
    props: Readonly<Record<string, unknown>>,
    key: string,
): string | number | undefined {
    if (key === "align") {
        const pick = (value: unknown): BlockAlign | undefined =>
            value === "left" || value === "center" || value === "right"
                ? value
                : undefined;
        return pick(props["align"]) ?? pick(defaultBlockProps(type)["align"]);
    }
    if (
        key === "fontSize" ||
        key === "padding" ||
        key === "borderWidth" ||
        key === "radius"
    ) {
        const pick = (value: unknown): number | undefined =>
            typeof value === "number" && Number.isFinite(value) && value >= 0
                ? value
                : undefined;
        return pick(props[key]) ?? pick(defaultBlockProps(type)[key]);
    }
    const pick = (value: unknown): string | undefined =>
        typeof value === "string" && value.trim().length > 0 ? value : undefined;
    return pick(props[key]) ?? pick(defaultBlockProps(type)[key]);
}

/**
 * Canvas class-level padding the export compiler must emit explicitly.
 *
 * The canvas renders a fixed padding via Tailwind classes even when no
 * `padding` prop is stored (`text` p-1.5, `button` px-3); MJML defaults
 * (10px 25px) differ, so export emits these fallbacks when neither props
 * nor theme resolve a padding. `box` resolves via its theme default (12);
 * `spacer` carries no padding.
 */
export function blockPaddingFallback(type: CanvasNodeType): string | undefined {
    switch (type) {
        case "text":
            return "6px";
        case "button":
            return "0px 12px";
        case "image":
            return "0px";
        case "divider":
            return "0px";
        case "box":
            return undefined;
        case "spacer":
            return undefined;
    }
}

function isAbsoluteHttpsImageSrc(value: unknown): boolean {
    if (typeof value !== "string" || value !== value.trim()) return false;
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return false;
    }
    if (url.protocol !== "https:") return false;
    return !url.pathname.toLowerCase().endsWith(".svg");
}

export const canvasNodeSchema = z
    .object({
        id: z.string().min(1, "Node id is required"),
        // "stage" marks an artboard-root node; any other value must be a box id.
        parentId: z.string().min(1, "parentId is required"),
        type: canvasNodeTypeSchema,
        x: z.number(),
        y: z.number(),
        w: z.number(),
        h: z.number(),
        rotation: z.number(),
        z: z.number(),
        props: z.record(z.string(), z.unknown()),
    })
    .superRefine((node, ctx) => {
        if (node.type === "image" && !isAbsoluteHttpsImageSrc(node.props.src)) {
            ctx.addIssue({
                code: "custom",
                message:
                    "Image src must be an absolute https URL (cid:, data:, http: and .svg are not allowed)",
                path: ["props", "src"],
            });
        }
        if (node.type === "text") {
            const text = node.props.text;
            if (typeof text !== "string") {
                ctx.addIssue({
                    code: "custom",
                    message: "Text node requires props.text to be a string",
                    path: ["props", "text"],
                });
            } else if (text.length > CANVAS_TEXT_MAX) {
                ctx.addIssue({
                    code: "custom",
                    message: `Text must be at most ${CANVAS_TEXT_MAX} characters`,
                    path: ["props", "text"],
                });
            }
        }
        // P1-1 style keys are optional (absent = theme/MJML defaults), but when
        // present they must be well-formed so the export compiler can trust them.
        const style = blockStylePropsSchema.safeParse(node.props);
        if (!style.success) {
            for (const issue of style.error.issues) {
                ctx.addIssue({ ...issue, path: ["props", ...issue.path] });
            }
        }
    });

export type CanvasNode = z.infer<typeof canvasNodeSchema>;

export const canvasDocSchema = z
    .object({
        version: z.literal(1),
        width: z.literal(CANVAS_WIDTH),
        nodes: z.record(z.string(), canvasNodeSchema),
        rootIds: z.array(z.string()),
    })
    .superRefine((doc, ctx) => {
        const ids = Object.keys(doc.nodes);
        if (ids.length > CANVAS_MAX_NODES) {
            ctx.addIssue({
                code: "custom",
                message: `Doc may hold at most ${CANVAS_MAX_NODES} nodes`,
                path: ["nodes"],
            });
        }

        const rootSet = new Set<string>();
        doc.rootIds.forEach((rootId, index) => {
            if (rootSet.has(rootId)) {
                ctx.addIssue({
                    code: "custom",
                    message: `Duplicate rootId: ${rootId}`,
                    path: ["rootIds", index],
                });
                return;
            }
            rootSet.add(rootId);
            const node = doc.nodes[rootId];
            if (!node) {
                ctx.addIssue({
                    code: "custom",
                    message: `rootId references missing node: ${rootId}`,
                    path: ["rootIds", index],
                });
            } else if (node.parentId !== CANVAS_STAGE_PARENT) {
                ctx.addIssue({
                    code: "custom",
                    message: `rootId must be a stage child: ${rootId}`,
                    path: ["rootIds", index],
                });
            }
        });

        // Depth ≤1: a node is either a stage child or a child of a stage-child box.
        for (const id of ids) {
            const node = doc.nodes[id];
            if (node.parentId === CANVAS_STAGE_PARENT) {
                if (!rootSet.has(id)) {
                    ctx.addIssue({
                        code: "custom",
                        message: `Stage child missing from rootIds: ${id}`,
                        path: ["nodes", id, "parentId"],
                    });
                }
                continue;
            }
            const parent = doc.nodes[node.parentId];
            if (!parent) {
                ctx.addIssue({
                    code: "custom",
                    message: `Missing parent: ${node.parentId}`,
                    path: ["nodes", id, "parentId"],
                });
            } else if (parent.type !== "box") {
                ctx.addIssue({
                    code: "custom",
                    message: `Only box nodes may have children (parent ${parent.id} is ${parent.type})`,
                    path: ["nodes", id, "parentId"],
                });
            } else if (parent.parentId !== CANVAS_STAGE_PARENT) {
                ctx.addIssue({
                    code: "custom",
                    message: `Depth exceeds 1 under ${parent.id}`,
                    path: ["nodes", id, "parentId"],
                });
            }
        }
    });

export type CanvasDoc = z.infer<typeof canvasDocSchema>;
