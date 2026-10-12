import { z } from "zod";

export const CAMPAIGN_STATUSES = [
    "draft",
    "scheduled",
    "queued",
    "sending",
    "sent",
    "cancelled",
    "failed",
] as const;

export const CampaignStatusSchema = z.enum(CAMPAIGN_STATUSES);

export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
    draft: "Draft",
    scheduled: "Scheduled",
    queued: "Queued",
    sending: "Sending",
    sent: "Sent",
    cancelled: "Cancelled",
    failed: "Failed",
};

export interface MsCampaignRow {
    id: number;
    campaign_key: string;
    campaign_name: string;
    template_id: number | null;
    group_ids: number[];
    status: CampaignStatus;
    scheduled_at: string | null;
    started_at: string | null;
    finished_at: string | null;
    total_count: number;
    sent_count: number;
    failed_count: number;
    skipped_count: number;
    run_seq: number;
    created_at: string | null;
    created_by: string | null;
    updated_at: string | null;
    updated_by: string | null;
}

const campaignKeyShapeSchema = z
    .string()
    .trim()
    .min(1, "Campaign key is required")
    .max(64, "Campaign key must be at most 64 characters");

const campaignNameShapeSchema = z
    .string()
    .trim()
    .min(1, "Campaign name is required")
    .max(255, "Campaign name must be at most 255 characters");

const groupIdsShapeSchema = z
    .array(z.number().int().positive("Group ids must be positive integers"))
    .min(1, "At least one group is required");

const templateIdShapeSchema = z
    .number()
    .int()
    .positive("Template id must be a positive integer")
    .nullable()
    .optional();

const scheduledAtShapeSchema = z.string().nullable().optional();

export const msCampaignCreateBodySchema = z.object({
    campaign_key: campaignKeyShapeSchema,
    campaign_name: campaignNameShapeSchema,
    template_id: templateIdShapeSchema,
    group_ids: groupIdsShapeSchema,
    scheduled_at: scheduledAtShapeSchema,
}).strict();

export type MsCampaignCreateBody = z.infer<typeof msCampaignCreateBodySchema>;

export const msCampaignUpdateBodySchema = z.object({
    campaign_name: campaignNameShapeSchema.optional(),
    template_id: templateIdShapeSchema,
    group_ids: groupIdsShapeSchema.optional(),
    scheduled_at: scheduledAtShapeSchema,
}).strict();

export type MsCampaignUpdateBody = z.infer<typeof msCampaignUpdateBodySchema>;
