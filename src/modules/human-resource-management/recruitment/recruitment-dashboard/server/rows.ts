import { z } from "zod";

const intOrNull = z.union([z.number(), z.string()]).nullable().optional().transform((v) => {
    if (v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
});

const strOrNull = z.string().nullable().optional();

const numOrNull = z.union([z.number(), z.string()]).nullable().optional().transform((v) => {
    if (v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
});

export const applicantRowSchema = z.object({
    id: z.coerce.number(),
    status: strOrNull,
    created_at: strOrNull,
    position_applied_for: strOrNull,
    manpower_request_id: intOrNull,
});
export type ApplicantRow = z.infer<typeof applicantRowSchema>;

export const applicationRowSchema = z.object({
    id: z.coerce.number(),
    applicant_id: intOrNull,
    email: strOrNull,
    submitted_at: strOrNull,
    quiz_score: numOrNull,
    quiz_passed: z.union([z.boolean(), z.number()]).nullable().optional(),
    how_heard: strOrNull,
    position_applied_for: strOrNull,
});
export type ApplicationRow = z.infer<typeof applicationRowSchema>;

export const quizAttemptRowSchema = z.object({
    applicant_id: intOrNull,
    passed: z.union([z.boolean(), z.number()]).nullable().optional(),
    percentage_score: numOrNull,
    completed_at: strOrNull,
});
export type QuizAttemptRow = z.infer<typeof quizAttemptRowSchema>;

export const interviewRowSchema = z.object({
    application_id: intOrNull,
    stage: strOrNull,
    verdict: strOrNull,
});
export type InterviewRow = z.infer<typeof interviewRowSchema>;

export const recommendationRowSchema = z.object({
    applicant_id: intOrNull,
    status: strOrNull,
});
export type RecommendationRow = z.infer<typeof recommendationRowSchema>;

export const offerRowSchema = z.object({
    applicant_id: intOrNull,
    status: strOrNull,
});
export type OfferRow = z.infer<typeof offerRowSchema>;

export const envelopeRowSchema = z.object({
    applicant_id: intOrNull,
    status: strOrNull,
});
export type EnvelopeRow = z.infer<typeof envelopeRowSchema>;

export const manpowerRowSchema = z.object({
    id: z.coerce.number(),
    position: strOrNull,
    status: strOrNull,
    requesting_department_id: intOrNull,
});
export type ManpowerRow = z.infer<typeof manpowerRowSchema>;

export const taskUserRowSchema = z.object({
    user_id: intOrNull,
    status: strOrNull,
    count: z.coerce.number(),
});
export type TaskUserRow = z.infer<typeof taskUserRowSchema>;

export const dashboardUserRowSchema = z.object({
    user_id: z.coerce.number(),
    user_email: strOrNull,
    personal_email: strOrNull,
    user_fname: strOrNull,
    user_lname: strOrNull,
    user_position: strOrNull,
    user_department: intOrNull,
    user_dateOfHire: strOrNull,
});
export type DashboardUserRow = z.infer<typeof dashboardUserRowSchema>;

export const departmentRowSchema = z.object({
    department_id: z.coerce.number(),
    department_name: strOrNull,
});
export type DepartmentRow = z.infer<typeof departmentRowSchema>;

export const trackingRowSchema = z.object({
    user_id: intOrNull,
    date_hired_snapshot: strOrNull,
    recommendation_issued_at: strOrNull,
    regularized_at: strOrNull,
    terminated_at: strOrNull,
});
export type TrackingRow = z.infer<typeof trackingRowSchema>;

export const evaluationRowSchema = z.object({
    user_id: intOrNull,
    eval_type: strOrNull,
    result: strOrNull,
    voided_at: strOrNull,
});
export type EvaluationRow = z.infer<typeof evaluationRowSchema>;

export const pipRowSchema = z.object({
    user_id: intOrNull,
    status: strOrNull,
    employee_acknowledged_at: strOrNull,
});
export type PipRow = z.infer<typeof pipRowSchema>;
