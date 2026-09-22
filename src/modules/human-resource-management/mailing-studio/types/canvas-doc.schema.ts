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
