import { z } from "zod";
import {
    APPLICANT_STATUS,
    ApplicantStatusSchema,
} from "@/modules/human-resource-management/onboarding/types/applicant-status";
import type { ApplicantStatus } from "@/modules/human-resource-management/onboarding/types/applicant-status";

// The single applicant-status vocabulary (snake_case `applicant.status` values)
// is owned by the onboarding contracts; re-exported here so consumers of this
// module import the status vocabulary from one place.
export { APPLICANT_STATUS, ApplicantStatusSchema };
export type { ApplicantStatus };

export const ApplicantTimelineEventSchema = z.object({
    /** Source row id (unique within `kind`). */
    id: z.number(),
    /** Which retained table the real event came from. */
    kind: z.enum(["initial_interview", "final_interview", "recommendation"]),
    at: z.string().nullable(),
    detail: z.string(),
});

export const ApplicantRowSchema = z.object({
    id: z.number(),
    full_name: z.string(),
    position_applied_for: z.string().nullable(),
    application_id: z.number().nullable(),
    submitted_at: z.string().nullable(),
    quiz_passed: z.boolean().nullable(),
    /** `applicant.status` verbatim; null when absent/non-canonical (placeholder in UI). */
    status: ApplicantStatusSchema.nullable(),
    timeline: z.array(ApplicantTimelineEventSchema),
});

export type ApplicantRow = z.infer<typeof ApplicantRowSchema>;

export type ApplicantTimelineEvent = z.infer<typeof ApplicantTimelineEventSchema>;

/** Display labels for the snake_case status values (display-only, never written). */
export const APPLICANT_STATUS_LABELS: Record<ApplicantStatus, string> = {
    draft: "Draft",
    submitted: "Submitted",
    quiz_completed: "Quiz Completed",
    initial_interview: "Initial Interview",
    verdict_pending: "Verdict Pending",
    recommended: "Recommended",
    final_interview: "Final Interview",
    final_approved: "Final Approved",
    for_signing: "For Signing",
    incomplete: "Incomplete",
    hired: "Hired",
    rejected: "Rejected",
    withdrawn: "Withdrawn",
};

export interface ApplicantFilters {
    search: string;
    status: ApplicantStatus | null;
}
