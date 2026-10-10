import { z } from "zod";

export const SUPPRESSION_REASONS = [
    "unsubscribed",
    "bounced",
    "complained",
    "manual",
] as const;

export const SuppressionReasonSchema = z.enum(SUPPRESSION_REASONS);

export type SuppressionReason = z.infer<typeof SuppressionReasonSchema>;

export const SUPPRESSION_REASON_LABELS: Record<SuppressionReason, string> = {
    unsubscribed: "Unsubscribed",
    bounced: "Bounced",
    complained: "Complained",
    manual: "Added manually",
};

export interface MsSuppressionRow {
    id: number;
    email: string;
    reason: SuppressionReason;
    note: string | null;
    created_at: string | null;
    created_by: string | null;
}

const suppressionEmailShapeSchema = z
    .string()
    .trim()
    .toLowerCase()
    .email("Suppression email must be valid")
    .max(320, "Suppression email must be at most 320 characters");

export const msSuppressionCreateBodySchema = z.object({
    email: suppressionEmailShapeSchema,
    reason: SuppressionReasonSchema,
    note: z.string().nullable().optional(),
}).strict();

export type MsSuppressionCreateBody = z.infer<typeof msSuppressionCreateBodySchema>;

export const msSuppressionUpdateBodySchema = z.object({
    reason: SuppressionReasonSchema.optional(),
    note: z.string().nullable().optional(),
}).strict();

export type MsSuppressionUpdateBody = z.infer<typeof msSuppressionUpdateBodySchema>;
