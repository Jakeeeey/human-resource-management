import { z } from "zod";

export const MS_EVENT_KEY_PATTERN = /^[a-z0-9_.]+$/;

export const msEventKeyShapeSchema = z
    .string()
    .min(1, "Event key is required")
    .regex(
        MS_EVENT_KEY_PATTERN,
        "Event key may only contain lowercase letters, digits, dots and underscores",
    );

export const msEventKeySchema = msEventKeyShapeSchema;

export type MsEventKey = z.infer<typeof msEventKeySchema>;

export const MS_BODY_HTML_MAX = 100_000;

export const MS_DESIGN_JSON_MAX = 1_000_000;

function isValidJson(value: string): boolean {
    try {
        JSON.parse(value);
        return true;
    } catch {
        return false;
    }
}

export const msTemplateSchema = z
    .object({
        template_key: z.string().min(1, "Template key is required"),
        template_name: z.string().min(1, "Template name is required"),
        subject: z.string().min(1, "Subject is required"),
        body_html: z
            .string()
            .min(1, "Body is required")
            .max(MS_BODY_HTML_MAX, `Body must be at most ${MS_BODY_HTML_MAX} characters`),
        body_text: z.string().min(1, "Plaintext body is required"),
        design_json: z
            .string()
            .max(MS_DESIGN_JSON_MAX, `design_json must be at most ${MS_DESIGN_JSON_MAX} characters`)
            .refine(isValidJson, "design_json must be valid JSON")
            .optional()
            .nullable(),
        variables: z.array(z.string().min(1)).max(200).optional().nullable(),
        is_active: z.boolean(),
        created_at: z.string().optional().nullable(),
        updated_at: z.string().optional().nullable(),
        updated_by: z.string().optional().nullable(),
    });

export type MsTemplate = z.infer<typeof msTemplateSchema>;
