import { z } from "zod";

export const ID_CARD = {
    width: 408,
    height: 648,
} as const;

export const ID_VARIABLES = [
    "full_name",
    "user_id",
    "user_contact",
    "user_email",
    "full_address",
    "user_bday",
    "emergency_contact_name",
    "emergency_contact_number",
    "user_department",
    "user_position",
    "user_dateOfHire",
    "external_id",
    "user_tin",
    "user_sss",
    "user_philhealth",
    "user_pagibig",
    "company_name",
] as const;

export type IdVariableField = (typeof ID_VARIABLES)[number];

const ID_STAGE_PARENT = "stage";

const ID_RASTER_PREFIXES = [
    "data:image/png;base64,",
    "data:image/jpeg;base64,",
    "data:image/webp;base64,",
];

function isRasterDataUrl(value: unknown): value is string {
    if (typeof value !== "string") {
        return false;
    }
    return ID_RASTER_PREFIXES.some(
        (prefix) => value.length > prefix.length && value.startsWith(prefix),
    );
}

const idVariableFieldSchema = z.enum(ID_VARIABLES);
const idAlignSchema = z.enum(["left", "center", "right"]);
const idFontWeightSchema = z.union([z.string().min(1), z.number().finite()]);
const idTransformSchema = z.enum(["none", "upper", "lower"]);

const idNodeBase = {
    id: z.string().min(1),
    parentId: z.string().min(1),
    x: z.number().finite(),
    y: z.number().finite(),
    w: z.number().finite().positive(),
    h: z.number().finite().positive(),
    rotation: z.number().finite(),
    z: z.number().int().min(0),
    opacity: z.number().min(0).max(1),
    locked: z.boolean().default(false),
};

const idTextPropsSchema = z.object({
    text: z.string(),
    fontFamily: z.string().min(1),
    fontSize: z.number().finite().positive(),
    fontWeight: idFontWeightSchema,
    italic: z.boolean(),
    underline: z.boolean(),
    strikethrough: z.boolean().default(false),
    color: z.string().min(1),
    align: idAlignSchema,
    letterSpacing: z.number().finite(),
    lineHeight: z.number().finite().positive(),
    strokeWidth: z.number().finite().min(0).optional(),
    strokeColor: z.string().min(1).optional(),
});

const idVariablePropsSchema = z.object({
    field: idVariableFieldSchema,
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    transform: idTransformSchema,
    fontFamily: z.string().min(1),
    fontSize: z.number().finite().positive(),
    fontWeight: idFontWeightSchema,
    italic: z.boolean().default(false),
    underline: z.boolean().default(false),
    strikethrough: z.boolean().default(false),
    color: z.string().min(1),
    align: idAlignSchema,
    letterSpacing: z.number().finite(),
    lineHeight: z.number().finite().positive(),
    strokeWidth: z.number().finite().min(0).optional(),
    strokeColor: z.string().min(1).optional(),
});

const idImageMaskSchema = z.enum(["none", "circle", "ellipse", "rounded", "diamond", "hexagon", "star"]);

const idImagePropsSchema = z
    .object({
        source: z.enum(["asset", "field"]),
        src: z.string().optional(),
        field: z.enum(["user_image", "signature"]).optional(),
        fit: z.enum(["cover", "contain", "fill"]),
        radius: z.number().finite().min(0),
        mask: idImageMaskSchema.default("none"),
        opacity: z.number().min(0).max(1),
    })
    .superRefine((props, ctx) => {
        if (props.source === "asset" && !isRasterDataUrl(props.src)) {
            ctx.addIssue({
                code: "custom",
                message: "Asset image src must be a raster data URL (png, jpeg, or webp)",
                path: ["src"],
            });
        }
        if (props.source === "field" && props.field === undefined) {
            ctx.addIssue({
                code: "custom",
                message: "Field image requires a field of user_image or signature",
                path: ["field"],
            });
        }
    });

const idShapePropsSchema = z.object({
    shape: z.enum(["rect", "ellipse", "line", "triangle", "diamond", "pentagon", "hexagon", "star", "arrow"]),
    fill: z.string().min(1),
    borderColor: z.string().min(1),
    borderWidth: z.number().finite().min(0),
    radius: z.number().finite().min(0),
    opacity: z.number().min(0).max(1),
});

const idTextNodeSchema = z.object({
    ...idNodeBase,
    type: z.literal("text"),
    props: idTextPropsSchema,
});

const idVariableNodeSchema = z.object({
    ...idNodeBase,
    type: z.literal("variable"),
    props: idVariablePropsSchema,
});

const idImageNodeSchema = z.object({
    ...idNodeBase,
    type: z.literal("image"),
    props: idImagePropsSchema,
});

const idShapeNodeSchema = z.object({
    ...idNodeBase,
    type: z.literal("shape"),
    props: idShapePropsSchema,
});

export const idNodeSchema = z.discriminatedUnion("type", [
    idTextNodeSchema,
    idVariableNodeSchema,
    idImageNodeSchema,
    idShapeNodeSchema,
]);

export type IdNode = z.infer<typeof idNodeSchema>;

export const idPageSchema = z.object({
    id: z.string().min(1),
    side: z.enum(["front", "back"]),
    rootIds: z.array(z.string().min(1)),
});

export type IdPage = z.infer<typeof idPageSchema>;

export const idDocSchema = z
    .object({
        version: z.literal(2),
        card: z.object({
            width: z.number(),
            height: z.number(),
        }),
        pages: z.array(idPageSchema),
        nodes: z.record(z.string(), idNodeSchema),
    })
    .superRefine((doc, ctx) => {
        if (doc.version !== 2) {
            ctx.addIssue({
                code: "custom",
                message: "IdDoc version must be 2",
                path: ["version"],
            });
        }
        const fronts = doc.pages.filter((page) => page.side === "front").length;
        const backs = doc.pages.filter((page) => page.side === "back").length;
        if (doc.pages.length !== 2 || fronts !== 1 || backs !== 1) {
            ctx.addIssue({
                code: "custom",
                message: "IdDoc must hold exactly two pages, one front and one back",
                path: ["pages"],
            });
        }
        if (doc.card.width !== ID_CARD.width || doc.card.height !== ID_CARD.height) {
            ctx.addIssue({
                code: "custom",
                message: "IdDoc card must be 408 by 648",
                path: ["card"],
            });
        }
        const membership = new Map<string, number>();
        doc.pages.forEach((page) => {
            page.rootIds.forEach((rootId) => {
                membership.set(rootId, (membership.get(rootId) ?? 0) + 1);
            });
        });
        Object.entries(doc.nodes).forEach(([id, node]) => {
            if (node.parentId !== ID_STAGE_PARENT) {
                ctx.addIssue({
                    code: "custom",
                    message: `Node ${id} parentId must be stage`,
                    path: ["nodes", id, "parentId"],
                });
            }
            const count = membership.get(id) ?? 0;
            if (count === 0) {
                ctx.addIssue({
                    code: "custom",
                    message: `Node ${id} is an orphan with no page`,
                    path: ["nodes", id],
                });
            }
            if (count > 1) {
                ctx.addIssue({
                    code: "custom",
                    message: `Node ${id} belongs to more than one page`,
                    path: ["pages"],
                });
            }
            if (node.type === "variable" && !ID_VARIABLES.includes(node.props.field)) {
                ctx.addIssue({
                    code: "custom",
                    message: `Node ${id} has an unknown variable field`,
                    path: ["nodes", id, "props", "field"],
                });
            }
        });
        doc.pages.forEach((page, pageIndex) => {
            page.rootIds.forEach((rootId, rootIndex) => {
                if (!doc.nodes[rootId]) {
                    ctx.addIssue({
                        code: "custom",
                        message: `Page ${page.id} references missing node ${rootId}`,
                        path: ["pages", pageIndex, "rootIds", rootIndex],
                    });
                }
            });
            const ordered = page.rootIds
                .map((rootId) => doc.nodes[rootId]?.z)
                .filter((value) => value !== undefined)
                .sort((a, b) => a - b);
            const permutation =
                ordered.length === page.rootIds.length &&
                ordered.every((value, index) => value === index);
            if (!permutation) {
                ctx.addIssue({
                    code: "custom",
                    message: `Page ${page.id} z values must permute 0 to ${page.rootIds.length - 1}`,
                    path: ["pages", pageIndex, "rootIds"],
                });
            }
        });
    });

export type IdDoc = z.infer<typeof idDocSchema>;
