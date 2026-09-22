import { z } from "zod";

// Outbox status enum — byte-parity with old mailOutboxStatusSchema
// (Appendix Paths row + mailing-templates.md §3, with the Appendix `queued` addition).
export const msOutboxStatusSchema = z.enum(["queued", "sent", "failed", "skipped", "dry_run"]);

export type MsOutboxStatus = z.infer<typeof msOutboxStatusSchema>;

// ms_outbox row — parity with the frozen mail_outbox contract: full to_email storage
// (masking happens at the viewer layer), per-send warnings JSON defaulting to [],
// unique idempotency_key. The event_key enum is written inline instead of imported so
// this schema file stays runtime-standalone; the T2 assert suite pins it to
// ms-template's msEventKeySchema (drift fails the gate).
export const msOutboxSchema = z.object({
    idempotency_key: z.string().min(1, "Idempotency key is required"),
    to_email: z.string().email("Recipient email must be valid"),
    template_id: z.union([z.string(), z.number().int()]).optional().nullable(),
    event_key: z.enum([
        "initial_interview.graded",
        "final_interview.graded",
        "final_interview.invited",
    ]),
    status: msOutboxStatusSchema,
    warnings: z.array(z.string()).default([]),
    error: z.string().optional().nullable(),
    sent_at: z.string().optional().nullable(),
    rendered_subject: z.string().optional().nullable(),
    rendered_body_html: z.string().optional().nullable(),
});

export type MsOutbox = z.infer<typeof msOutboxSchema>;
