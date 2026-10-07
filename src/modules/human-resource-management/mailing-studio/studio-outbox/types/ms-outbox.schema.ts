import { z } from "zod";

export const msOutboxStatusSchema = z.enum(["queued", "sent", "failed", "skipped", "dry_run"]);

export type MsOutboxStatus = z.infer<typeof msOutboxStatusSchema>;

export const MS_EVENT_KEY_PATTERN = /^[a-z0-9_.]+$/;

export const msEventKeyShapeSchema = z
    .string()
    .min(1, "Event key is required")
    .regex(
        MS_EVENT_KEY_PATTERN,
        "Event key may only contain lowercase letters, digits, dots and underscores",
    );

export const msOutboxSchema = z.object({
    idempotency_key: z.string().min(1, "Idempotency key is required"),
    to_email: z.string().email("Recipient email must be valid"),
    template_id: z.union([z.string(), z.number().int()]).optional().nullable(),
    event_key: msEventKeyShapeSchema,
    status: msOutboxStatusSchema,
    warnings: z.array(z.string()).default([]),
    error: z.string().optional().nullable(),
    sent_at: z.string().optional().nullable(),
    rendered_subject: z.string().optional().nullable(),
    rendered_body_html: z.string().optional().nullable(),
});

export type MsOutbox = z.infer<typeof msOutboxSchema>;
