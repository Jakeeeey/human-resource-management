import { z } from "zod";

// Frozen mail event keys (mailing-module Appendix — Events row).
// initial_interview.graded + final_interview.graded are AUTO (stage-routed);
// final_interview.invited is MANUAL-ONLY (Send-now, never auto-bound).
export const mailEventKeySchema = z.enum([
    "initial_interview.graded",
    "final_interview.graded",
    "final_interview.invited",
]);

export type MailEventKey = z.infer<typeof mailEventKeySchema>;

// Frozen renderer var allowlist (Appendix Renderer row = union of the core 6
// plus input-plan mailing-templates.md §5). Unknown {{x}} at SEND renders as
// "" + a warnings[] entry `unknown-var:x` (see utils/mailRenderer.ts).
// NOTE: candidate_name/result are legacy aliases from the input plan kept for
// compat — new templates should prefer applicant_name/verdict.
export const mailVarAllowlist = [
    "applicant_name",
    "candidate_name",
    "position",
    "verdict",
    "result",
    "decision_date",
    "request_no",
    "company_name",
    "salutation_name",
    "base_location",
    "department",
    "division",
    "interview_date",
    "interview_time",
    "venue",
    "contact_person",
    "sender_name",
] as const;

export type MailVarName = (typeof mailVarAllowlist)[number];

// Body storage caps (Appendix Body storage row): sanitized body_html ≤100_000.
export const MAIL_BODY_HTML_MAX = 100_000;

// mail_templates row (mailing-templates.md §3 field list + Appendix additions).
// subject supports {{vars}}; body_text is plaintext auto-generated at save via
// the module converter (utils/mailText.ts). Timestamps stay z.string() —
// format is enforced by the single PH-time producer (conventions.md §6).
export const mailTemplateSchema = z.object({
    template_key: z.string().min(1, "Template key is required"),
    template_name: z.string().min(1, "Template name is required"),
    subject: z.string().min(1, "Subject is required"),
    body_html: z
        .string()
        .min(1, "Body is required")
        .max(MAIL_BODY_HTML_MAX, `Body must be at most ${MAIL_BODY_HTML_MAX} characters`),
    body_text: z.string().min(1, "Plaintext body is required"),
    is_active: z.boolean(),
    created_at: z.string().optional().nullable(),
    updated_at: z.string().optional().nullable(),
    updated_by: z.string().optional().nullable(),
});

export type MailTemplate = z.infer<typeof mailTemplateSchema>;
