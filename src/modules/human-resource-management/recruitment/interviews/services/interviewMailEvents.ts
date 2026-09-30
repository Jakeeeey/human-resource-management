import { emitEvent } from "@/app/api/hrm/mailing-studio/studio-bindings/events/emit/route";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const INTERVIEW_MAIL_EVENT_KEYS = {
    initialGraded: "initial_interview.graded",
    finalGraded: "final_interview.graded",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function unwrapData(body: unknown): unknown {
    return isRecord(body) ? body.data : undefined;
}

async function readApplicationRecipient(applicationId: number): Promise<{
    email: string;
    applicantId: number | null;
}> {
    const body: unknown = await dFetch(
        `/items/application/${applicationId}?fields=id,email,applicant_id`
    );
    const row = unwrapData(body);
    if (!isRecord(row)) return { email: "", applicantId: null };
    return {
        email: text(row.email),
        applicantId: typeof row.applicant_id === "number" ? row.applicant_id : null,
    };
}

async function readApplicantDetails(applicantId: number): Promise<{
    name: string;
    position: string;
}> {
    const body: unknown = await dFetch(
        `/items/applicant/${applicantId}?fields=id,full_name,position_applied_for`
    );
    const row = unwrapData(body);
    if (!isRecord(row)) return { name: "", position: "" };
    return {
        name: text(row.full_name),
        position: text(row.position_applied_for),
    };
}

export async function emitInterviewGradedEvent(input: {
    interviewId?: number | null;
    applicationId: number;
    stage: string;
    verdict: string;
}): Promise<void> {
    try {
        const eventKey =
            input.stage === "Final"
                ? INTERVIEW_MAIL_EVENT_KEYS.finalGraded
                : INTERVIEW_MAIL_EVENT_KEYS.initialGraded;
        const interviewId =
            typeof input.interviewId === "number" && Number.isFinite(input.interviewId)
                ? input.interviewId
                : null;
        const application = await readApplicationRecipient(input.applicationId);
        const applicant =
            application.applicantId === null
                ? { name: "", position: "" }
                : await readApplicantDetails(application.applicantId);
        await emitEvent({
            event_key: eventKey,
            payload: {
                to: application.email,
                ...(interviewId !== null
                    ? { id: interviewId, interview_id: interviewId }
                    : {}),
                application_id: input.applicationId,
                ...(application.applicantId !== null
                    ? { applicant_id: application.applicantId }
                    : {}),
                applicant_name: applicant.name,
                position: applicant.position,
                stage: input.stage,
                verdict: input.verdict,
                result: input.verdict,
            },
        });
    } catch (error) {
        console.error("[interview-mail] graded emit failed:", error);
    }
}
