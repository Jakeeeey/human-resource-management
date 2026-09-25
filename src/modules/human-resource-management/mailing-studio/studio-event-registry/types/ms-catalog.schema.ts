import { z } from "zod";

export const MS_EVENT_KEY_PATTERN = /^[a-z0-9_.]+$/;

export const msEventKeyShapeSchema = z
    .string()
    .min(1, "Event key is required")
    .regex(
        MS_EVENT_KEY_PATTERN,
        "Event key may only contain lowercase letters, digits, dots and underscores",
    );

export const MS_VARIABLE_NAME_PATTERN = /^[A-Za-z0-9_.]+$/;

export const MS_VARIABLE_TYPES = [
    "string",
    "number",
    "integer",
    "boolean",
    "array",
    "object",
    "null",
] as const;

export type MsVariableType = (typeof MS_VARIABLE_TYPES)[number];

export const MS_VARIABLE_TYPE_OPTIONS: readonly {
    readonly value: MsVariableType | "untyped";
    readonly label: string;
}[] = [
    { value: "untyped", label: "untyped" },
    { value: "string", label: "string" },
    { value: "number", label: "number" },
    { value: "integer", label: "integer" },
    { value: "boolean", label: "boolean" },
    { value: "array", label: "array" },
    { value: "object", label: "object" },
    { value: "null", label: "null" },
];

export interface MsVariableRow {
    name: string;
    type: MsVariableType | "untyped";
    example: string;
}

export const msVariableRowSchema = z.object({
    name: z
        .string()
        .min(1, "Variable name is required")
        .regex(
            MS_VARIABLE_NAME_PATTERN,
            "Variable name may only contain letters, digits, dots and underscores",
        ),
    type: z.enum([
        "string",
        "number",
        "integer",
        "boolean",
        "array",
        "object",
        "null",
        "untyped",
    ]),
    example: z.string(),
});

export const msVariableListSchema = z
    .array(msVariableRowSchema)
    .refine(
        (rows) => {
            const seen = new Set<string>();
            for (const row of rows) {
                if (seen.has(row.name)) return false;
                seen.add(row.name);
            }
            return true;
        },
        { message: "Variable names must be unique" },
    );

export interface MsCatalogRow {
    id: number | string;
    event_key: string;
    label: string;
    description: string | null;
    module: string | null;
    payload_schema: unknown;
    payload_example: unknown;
    is_active: boolean | number;
    created_at?: string | null;
    updated_at?: string | null;
}
