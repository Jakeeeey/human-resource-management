import { z } from "zod";

// Frozen mail event keys — byte-parity with recruitment/mailing mailEventKeySchema
// (initial_interview.graded + final_interview.graded are AUTO stage-routed;
// final_interview.invited is MANUAL-ONLY Send-now).
export const msEventKeySchema = z.enum([
    "initial_interview.graded",
    "final_interview.graded",
    "final_interview.invited",
]);

export type MsEventKey = z.infer<typeof msEventKeySchema>;

// Body storage cap — parity with old MAIL_BODY_HTML_MAX (Appendix Body storage row).
export const MS_BODY_HTML_MAX = 100_000;

// design_json cap (string ≤1M, JSON.parse-validated). Holds the serialized
// canvas-doc (types/canvas-doc.schema.ts) once the editor lands; optional while
// a template still has only legacy body_html.
export const MS_DESIGN_JSON_MAX = 1_000_000;

function isValidJson(value: string): boolean {
    try {
        JSON.parse(value);
        return true;
    } catch {
        return false;
    }
}

// ms_templates row — mirrors the frozen mail_templates contract (mailing-templates.md
// §3 field list) with exactly one addition: design_json. Deliberately NO variables /
// merge-tag allowlist anywhere in this module (mailing-studio non-goal).
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
        is_active: z.boolean(),
        created_at: z.string().optional().nullable(),
        updated_at: z.string().optional().nullable(),
        updated_by: z.string().optional().nullable(),
    });

export type MsTemplate = z.infer<typeof msTemplateSchema>;
