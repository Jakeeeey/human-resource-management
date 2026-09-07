import { z } from "zod";
import { APPLICANT_STAGE } from "./lib/deriveApplicantStage";
import type { StageTimelineEvent } from "./lib/deriveApplicantStage";

export const ApplicantStageSchema = z.enum(APPLICANT_STAGE);

export const StageTimelineEventSchema = z.object({
    stage: ApplicantStageSchema,
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
    stage: ApplicantStageSchema,
    timeline: z.array(StageTimelineEventSchema),
});

export type ApplicantRow = z.infer<typeof ApplicantRowSchema>;

export type { StageTimelineEvent };

export interface ApplicantFilters {
    search: string;
    stage: (typeof APPLICANT_STAGE)[number] | null;
}
