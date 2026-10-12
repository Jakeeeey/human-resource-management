import { z } from "zod";

export const RESIGNATION_STATUSES = ["pending", "approved", "rejected", "withdrawn"] as const;

export type ResignationStatus = (typeof RESIGNATION_STATUSES)[number];

export const RESIGNATION_STATUS_LABELS: Record<ResignationStatus, string> = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    withdrawn: "Withdrawn",
};

export const REMARKS_MAX_LENGTH = 1000;

export interface ResignationRequest {
    id: number;
    user_id: number;
    resignation_date: string;
    reason: string;
    status: ResignationStatus;
    attachment_uuid: string | null;
    attachment_name: string | null;
    attachment_type: string | null;
    hr_remarks: string | null;
    reviewed_by: number | null;
    reviewed_at: string | null;
    filed_at: string;
    created_by: number | null;
    updated_at: string | null;
    updated_by: number | null;
}

export interface ResignationRequestWithUser extends ResignationRequest {
    user_fname: string;
    user_lname: string;
    user_mname: string | null;
    department_name: string | null;
    reviewer_name: string | null;
    view_file_url: string | null;
}

export interface ResignationListResponse {
    data: ResignationRequestWithUser[];
    total: number;
}

export const ResignationReviewSchema = z.object({
    id: z.number(),
    status: z.enum(["approved", "rejected"]),
    remarks: z.string().trim().min(1).max(REMARKS_MAX_LENGTH),
});

export type ResignationReview = z.infer<typeof ResignationReviewSchema>;
