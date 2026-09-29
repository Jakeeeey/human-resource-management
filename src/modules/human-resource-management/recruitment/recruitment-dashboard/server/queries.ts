import { z } from "zod";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import type { StatusCount } from "../types";
import {
    applicantRowSchema,
    applicationRowSchema,
    dashboardUserRowSchema,
    departmentRowSchema,
    envelopeRowSchema,
    evaluationRowSchema,
    interviewRowSchema,
    manpowerRowSchema,
    offerRowSchema,
    pipRowSchema,
    quizAttemptRowSchema,
    recommendationRowSchema,
    taskUserRowSchema,
    trackingRowSchema,
    type ApplicantRow,
    type ApplicationRow,
    type DashboardUserRow,
    type DepartmentRow,
    type EnvelopeRow,
    type EvaluationRow,
    type InterviewRow,
    type ManpowerRow,
    type OfferRow,
    type PipRow,
    type QuizAttemptRow,
    type RecommendationRow,
    type TaskUserRow,
    type TrackingRow,
} from "./rows";

export const APPLICANT_ROW_CAP = 500;
export const APPLICATION_ROW_CAP = 500;
export const USER_ROW_CAP = 1000;

const countPayloadSchema = z.object({
    data: z.array(z.object({ count: z.coerce.number() })).catch([]),
});

const groupPayloadSchema = z.object({
    data: z.array(z.record(z.string(), z.unknown())).catch([]),
});

const averagePayloadSchema = z.object({
    data: z
        .array(
            z.object({
                avg: z
                    .object({ percentage_score: z.union([z.number(), z.string(), z.null()]).optional() })
                    .catch({ percentage_score: null }),
            })
        )
        .catch([]),
});

function listPath(collection: string, fields: string, limit: number, extra = ""): string {
    return `/items/${collection}?fields=${fields}&limit=${limit}${extra}`;
}

async function fetchCount(path: string): Promise<number> {
    const raw: unknown = await dFetch(path);
    const parsed = countPayloadSchema.safeParse(raw);
    if (!parsed.success) return 0;
    const first = parsed.data.data[0];
    return first ? first.count : 0;
}

async function fetchGroups(collection: string, field: string): Promise<StatusCount[]> {
    const raw: unknown = await dFetch(
        `/items/${collection}?groupBy[]=${field}&aggregate[count]=*&limit=100`
    );
    const parsed = groupPayloadSchema.safeParse(raw);
    if (!parsed.success) return [];
    return parsed.data.data.map((row) => {
        const value = row[field];
        const countValue = row["count"];
        const count = typeof countValue === "number" ? countValue : Number(countValue);
        return {
            status: typeof value === "string" && value.length > 0 ? value : "Unspecified",
            count: Number.isFinite(count) ? count : 0,
        };
    });
}

async function fetchList<Row>(schema: z.ZodType<Row>, path: string): Promise<Row[]> {
    const raw: unknown = await dFetch(path);
    const parsed = z.object({ data: z.array(schema).catch([]) }).safeParse(raw);
    if (!parsed.success) return [];
    return parsed.data.data;
}

export function fetchApplicantTotal(): Promise<number> {
    return fetchCount("/items/applicant?aggregate[count]=*&limit=1");
}

export function fetchApplicantByStatus(): Promise<StatusCount[]> {
    return fetchGroups("applicant", "status");
}

export function fetchApplicantRows(): Promise<ApplicantRow[]> {
    return fetchList(
        applicantRowSchema,
        listPath(
            "applicant",
            "id,status,created_at,position_applied_for,manpower_request_id",
            APPLICANT_ROW_CAP,
            "&sort[]=created_at"
        )
    );
}

export function fetchApplicationRows(): Promise<ApplicationRow[]> {
    return fetchList(
        applicationRowSchema,
        listPath(
            "application",
            "id,applicant_id,email,submitted_at,quiz_score,quiz_passed,how_heard,position_applied_for",
            APPLICATION_ROW_CAP
        )
    );
}

export function fetchApplicationsByHowHeard(): Promise<StatusCount[]> {
    return fetchGroups("application", "how_heard");
}

export function fetchQuizRows(): Promise<QuizAttemptRow[]> {
    return fetchList(
        quizAttemptRowSchema,
        listPath("quiz_attempt", "applicant_id,passed,percentage_score,completed_at", APPLICATION_ROW_CAP)
    );
}

export async function fetchQuizAveragePercentage(): Promise<number | null> {
    const raw: unknown = await dFetch("/items/quiz_attempt?aggregate[avg]=percentage_score&limit=1");
    const parsed = averagePayloadSchema.safeParse(raw);
    if (!parsed.success) return null;
    const first = parsed.data.data[0];
    if (!first) return null;
    const value = first.avg.percentage_score;
    if (value === null || value === undefined) return null;
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

export function fetchInterviewRows(): Promise<InterviewRow[]> {
    return fetchList(
        interviewRowSchema,
        listPath("interview", "application_id,stage,verdict", APPLICATION_ROW_CAP)
    );
}

export function fetchRecommendationRows(): Promise<RecommendationRow[]> {
    return fetchList(
        recommendationRowSchema,
        listPath("manpower_recommendation", "applicant_id,manpower_request_id,status", 200)
    );
}

export function fetchOffersByStatus(): Promise<StatusCount[]> {
    return fetchGroups("job_offer", "status");
}

export function fetchOfferRows(): Promise<OfferRow[]> {
    return fetchList(offerRowSchema, listPath("job_offer", "applicant_id,status", 200));
}

export function fetchEnvelopesByStatus(): Promise<StatusCount[]> {
    return fetchGroups("signing_envelope", "status");
}

export function fetchEnvelopeRows(): Promise<EnvelopeRow[]> {
    return fetchList(envelopeRowSchema, listPath("signing_envelope", "applicant_id,status", 200));
}

export function fetchManpowerByStatus(): Promise<StatusCount[]> {
    return fetchGroups("manpower_request", "status");
}

export function fetchManpowerRows(): Promise<ManpowerRow[]> {
    return fetchList(
        manpowerRowSchema,
        listPath("manpower_request", "id,position,status,requesting_department_id,no_manpower_needed", 100)
    );
}

export function fetchTasksByStatus(): Promise<StatusCount[]> {
    return fetchGroups("onboarding_task", "status");
}

export function fetchTasksByUser(): Promise<TaskUserRow[]> {
    return fetchList(
        taskUserRowSchema,
        "/items/onboarding_task?groupBy[]=user_id&groupBy[]=status&aggregate[count]=*&limit=500"
    );
}

export function fetchDashboardUsers(): Promise<DashboardUserRow[]> {
    return fetchList(
        dashboardUserRowSchema,
        listPath(
            "user",
            "user_id,user_email,personal_email,user_fname,user_lname,user_position,user_department,user_dateOfHire",
            USER_ROW_CAP
        )
    );
}

export function fetchDepartments(): Promise<DepartmentRow[]> {
    return fetchList(
        departmentRowSchema,
        listPath("department", "department_id,department_name", 100)
    );
}

export function fetchTrackingRows(): Promise<TrackingRow[]> {
    return fetchList(
        trackingRowSchema,
        listPath(
            "employee_evaluation_tracking",
            "user_id,date_hired_snapshot,recommendation_issued_at,regularized_at,terminated_at",
            200
        )
    );
}

export function fetchEvaluationRows(): Promise<EvaluationRow[]> {
    return fetchList(
        evaluationRowSchema,
        listPath("employee_evaluation", "user_id,eval_type,result,voided_at", 500)
    );
}

export function fetchPipRows(): Promise<PipRow[]> {
    return fetchList(
        pipRowSchema,
        listPath("employee_pip", "user_id,status,employee_acknowledged_at", 200)
    );
}

export function fetchPipRowsForUser(userId: number): Promise<PipRow[]> {
    return fetchList(
        pipRowSchema,
        listPath(
            "employee_pip",
            "user_id,status,employee_acknowledged_at",
            200,
            `&filter[user_id][_eq]=${userId}`
        )
    );
}

export function fetchDocumentsByState(): Promise<StatusCount[]> {
    return fetchGroups("onboarding_document_verification", "state");
}
