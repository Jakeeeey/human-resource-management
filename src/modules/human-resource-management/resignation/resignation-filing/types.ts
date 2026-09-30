import { z } from "zod";

export const RESIGNATION_STATUSES = ["pending", "approved", "rejected", "withdrawn"] as const;

export type ResignationStatus = (typeof RESIGNATION_STATUSES)[number];

export const RESIGNATION_STATUS_LABELS: Record<ResignationStatus, string> = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    withdrawn: "Withdrawn",
};

export const REASON_MAX_LENGTH = 1000;

export const REMARKS_MAX_LENGTH = 1000;

export const ATTACHMENT_ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"] as const;

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export function isCalendarDate(value: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
        return false;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12) {
        return false;
    }
    if (day < 1 || day > 31) {
        return false;
    }
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export const ResignationRequestSchema = z.object({
    id: z.number().optional(),
    user_id: z.number(),
    resignation_date: z.string(),
    reason: z.string().min(1).max(REASON_MAX_LENGTH),
    status: z.enum(RESIGNATION_STATUSES).default("pending"),
    attachment_uuid: z.string().nullable().optional(),
    attachment_name: z.string().nullable().optional(),
    attachment_type: z.string().nullable().optional(),
    hr_remarks: z.string().nullable().optional(),
    reviewed_by: z.number().nullable().optional(),
    reviewed_at: z.string().nullable().optional(),
    filed_at: z.string().nullable().optional(),
    created_by: z.number().nullable().optional(),
    updated_at: z.string().nullable().optional(),
    updated_by: z.number().nullable().optional(),
});

export type ResignationRequest = z.infer<typeof ResignationRequestSchema>;

export const ResignationFormSchema = z.object({
    resignation_date: z.string().refine(isCalendarDate),
    reason: z.string().trim().min(1).max(REASON_MAX_LENGTH),
    attachment_uuid: z.string().nullable().optional(),
    attachment_name: z.string().nullable().optional(),
    attachment_type: z.string().nullable().optional(),
});

export type ResignationForm = z.infer<typeof ResignationFormSchema>;

export const ResignationReviewSchema = z.object({
    id: z.number(),
    status: z.enum(["approved", "rejected"]),
    remarks: z.string().trim().min(1).max(REMARKS_MAX_LENGTH),
});

export type ResignationReview = z.infer<typeof ResignationReviewSchema>;

export interface EnrichedResignationRequest extends ResignationRequest {
    user_fname?: string;
    user_lname?: string;
    user_mname?: string;
    department_name?: string;
    reviewer_name?: string;
    view_file_url?: string;
}
