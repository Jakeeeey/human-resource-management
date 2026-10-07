import { z } from "zod";

import { mailEventKeySchema } from "./mail-template.schema";

// Outbox status enum (Appendix Paths row + mailing-templates.md §3, with the
// Appendix addition `queued`).
export const mailOutboxStatusSchema = z.enum(["queued", "sent", "failed", "skipped", "dry_run"]);

export type MailOutboxStatus = z.infer<typeof mailOutboxStatusSchema>;

// mail_outbox row (mailing-templates.md §3 + Appendix additions: `warnings`
// JSON field persisted per send; `queued` status). Unique index on
// idempotency_key is enforced in Directus (user-created schema, task-2).
// to_email is stored full (input-plan §3); display masking (j***@domain)
// happens at the viewer layer, never in storage.
export const mailOutboxSchema = z.object({
    idempotency_key: z.string().min(1, "Idempotency key is required"),
    to_email: z.string().email("Recipient email must be valid"),
    template_id: z.union([z.string(), z.number().int()]).optional().nullable(),
    event_key: mailEventKeySchema,
    status: mailOutboxStatusSchema,
    warnings: z.array(z.string()).default([]),
    error: z.string().optional().nullable(),
    sent_at: z.string().optional().nullable(),
    rendered_subject: z.string().optional().nullable(),
    rendered_body_html: z.string().optional().nullable(),
});

export type MailOutbox = z.infer<typeof mailOutboxSchema>;
