import { Interview, InterviewCreateInput } from "../types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const headers = {
    Authorization: `Bearer ${STATIC_TOKEN}`,
    "Content-Type": "application/json",
};

/**
 * Current Philippine wall time as MySQL-compatible 'YYYY-MM-DD HH:mm:ss' (no offset).
 * Single producer for ALL timestamp writes in this module — never rely on DB
 * CURRENT_TIMESTAMP (see conventions §6 Timestamp convention).
 * @returns PH wall time string.
 */
export function nowPH(): string {
    return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

/**
 * Quiz-completed application lookup row for the Initial-tab eligible list.
 */
export type QuizCompletedApplication = {
    id: number;
    applicant_id: number;
    quiz_score: number | null;
    quiz_passed: boolean | null;
    submitted_at: string | null;
};

/**
 * Approved recommendation lookup row for the Final-tab eligible list.
 */
export type ApprovedRecommendation = {
    id: number;
    applicant_id: number | null;
    manpower_request_id: number | null;
    status: string;
};

/**
 * Interview score-sheet item row (criterion snapshot + score).
 */
export type SheetItem = {
    id: number;
    sheet_id: number;
    criterion_id: number | null;
    criterion_name_snapshot: string;
    weight_percentage_snapshot: number;
    is_quiz_criterion: boolean;
    score: number;
    sort: number;
};

/**
 * Single criterion score input for the interview create flow.
 */
export type InterviewFlowItemInput = {
    criterion_id: number | null;
    criterion_name_snapshot: string;
    weight_percentage_snapshot: number;
    is_quiz_criterion: boolean;
    score: number;
    sort: number;
};

/**
 * Create-flow input: interview fields plus the criterion snapshots to persist.
 * Quiz-criterion rows carry the autofilled quiz percentage as their score.
 */
export type InterviewFlowInput = Omit<InterviewCreateInput, "score_sheet_id"> & {
    recorded_by?: number | null;
    items: InterviewFlowItemInput[];
};

/**
 * Interview list result with display-join lookups for client rendering.
 */
export type InterviewListResult = {
    interviews: Interview[];
    applications: { id: number; applicant_id: number | null }[];
    applicants: { id: number; full_name: string }[];
    requests: { id: number; request_no: string; position: string }[];
};

/**
 * Weighted-average composite guideline: SUM(score * weight) / 100.
 * @param items - Criterion snapshots with score + weight percentage.
 * @returns Composite score rounded to 2 decimals.
 */
export function computeComposite(items: Pick<SheetItem, "score" | "weight_percentage_snapshot">[] | InterviewFlowItemInput[]): number {
    const total = items.reduce((sum, item) => sum + item.score * item.weight_percentage_snapshot, 0);
    return Math.round((total / 100) * 100) / 100;
}

export const interviewService = {
    /**
     * Fetch all interviews, newest first, plus display-join lookups.
     * Applicant/request/application rows are fetched in parallel; a lookup
     * failure degrades to an empty array so the interview list still renders.
     * @returns Interviews with application/applicant/request lookups.
     */
    async fetchInterviews(): Promise<InterviewListResult> {
        try {
            const url =
                `${API_BASE_URL}/items/interview` +
                `?fields=*&sort=-created_at&limit=-1`;

            const response = await fetch(url, { headers });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [fetchInterviews]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            const rows: Record<string, unknown>[] = result.data;
            const interviews = rows.map(normalizeInterview);

            const [applications, applicants, requests] = await Promise.all([
                (async () => {
                    try {
                        const res = await fetch(`${API_BASE_URL}/items/application?fields=id,applicant_id&limit=-1`, { headers });
                        if (!res.ok) return [];
                        const json = await res.json();
                        return json.data.map((a: { id: number; applicant_id: number | null }) => ({
                            id: a.id,
                            applicant_id: a.applicant_id,
                        }));
                    } catch { return []; }
                })(),
                (async () => {
                    try {
                        const res = await fetch(`${API_BASE_URL}/items/applicant?fields=id,full_name&sort=full_name&limit=-1`, { headers });
                        if (!res.ok) return [];
                        const json = await res.json();
                        return json.data.map((a: { id: number; full_name: string }) => ({
                            id: a.id,
                            full_name: a.full_name,
                        }));
                    } catch { return []; }
                })(),
                (async () => {
                    try {
                        const res = await fetch(`${API_BASE_URL}/items/manpower_request?fields=id,request_no,position&limit=-1`, { headers });
                        if (!res.ok) return [];
                        const json = await res.json();
                        return json.data.map((r: { id: number; request_no: string; position: string }) => ({
                            id: r.id,
                            request_no: r.request_no,
                            position: r.position,
                        }));
                    } catch { return []; }
                })(),
            ]);

            return { interviews, applications, applicants, requests };
        } catch (e) {
            console.error("Error fetching interviews:", e);
            throw new Error("INTERNAL_FAIL: Failed to fetch interviews");
        }
    },

    /**
     * Fetch quiz-completed applications for the Initial-tab eligible list.
     * @returns Typed quiz-completed application lookup rows.
     */
    async fetchQuizCompletedApplications(): Promise<QuizCompletedApplication[]> {
        try {
            const url =
                `${API_BASE_URL}/items/application` +
                `?fields=id,applicant_id,quiz_score,quiz_passed,submitted_at` +
                `&filter[status][_eq]=Quiz Completed` +
                `&sort=-submitted_at&limit=-1`;
            const response = await fetch(url, { headers });
            if (!response.ok) return [];
            const result = await response.json();
            return result.data.map((a: { id: number; applicant_id: number; quiz_score: number | null; quiz_passed: boolean | null; submitted_at: string | null }) => ({
                id: a.id,
                applicant_id: a.applicant_id,
                quiz_score: a.quiz_score,
                quiz_passed: a.quiz_passed,
                submitted_at: a.submitted_at,
            }));
        } catch { return []; }
    },

    /**
     * Fetch Approved recommendations on Approved requests for the Final-tab
     * eligible list (mirrors the openRequests pattern: open requests first,
     * then recs scoped to those request ids).
     * @returns Typed approved recommendation lookup rows.
     */
    async fetchApprovedRecommendations(): Promise<ApprovedRecommendation[]> {
        try {
            const openRes = await fetch(
                `${API_BASE_URL}/items/manpower_request` +
                `?fields=id&filter[status][_eq]=Approved&limit=-1`,
                { headers }
            );
            if (!openRes.ok) return [];
            const openJson = await openRes.json();
            const openIds = (openJson.data as { id: number }[]).map((r) => r.id);
            if (openIds.length === 0) return [];

            const recRes = await fetch(
                `${API_BASE_URL}/items/manpower_recommendation` +
                `?fields=id,applicant_id,manpower_request_id,status` +
                `&filter[status][_eq]=Approved` +
                `&filter[manpower_request_id][_in]=${openIds.join(",")}` +
                `&sort=-created_at&limit=-1`,
                { headers }
            );
            if (!recRes.ok) return [];
            const recJson = await recRes.json();
            return recJson.data.map((r: { id: number; applicant_id: number | null; manpower_request_id: number | null; status: string }) => ({
                id: r.id,
                applicant_id: r.applicant_id,
                manpower_request_id: r.manpower_request_id,
                status: r.status,
            }));
        } catch { return []; }
    },

    /**
     * Fetch the latest quiz_attempt percentage for an application.
     * @param applicationId - Application record ID.
     * @returns Latest percentage score, or null when no attempt exists.
     */
    async fetchLatestQuizPercentage(applicationId: number): Promise<number | null> {
        try {
            const url =
                `${API_BASE_URL}/items/quiz_attempt` +
                `?filter[application_id][_eq]=${applicationId}` +
                `&fields=percentage_score&sort=-completed_at&limit=1`;
            const response = await fetch(url, { headers });
            if (!response.ok) return null;
            const result = await response.json();
            const rows = result.data as { percentage_score: number | null }[];
            if (rows.length === 0) return null;
            return rows[0].percentage_score;
        } catch { return null; }
    },

    /**
     * Fetch score-sheet items for a sheet, in criterion sort order.
     * @param sheetId - Interview score sheet record ID.
     * @returns Typed sheet item rows.
     */
    async fetchSheetItems(sheetId: number): Promise<SheetItem[]> {
        try {
            const url =
                `${API_BASE_URL}/items/interview_score_sheet_item` +
                `?filter[sheet_id][_eq]=${sheetId}` +
                `&fields=id,sheet_id,criterion_id,criterion_name_snapshot,weight_percentage_snapshot,is_quiz_criterion,score,sort` +
                `&sort=sort&limit=-1`;
            const response = await fetch(url, { headers });
            if (!response.ok) return [];
            const result = await response.json();
            return result.data.map((i: { id: number; sheet_id: number; criterion_id: number | null; criterion_name_snapshot: string; weight_percentage_snapshot: number; is_quiz_criterion: boolean; score: number; sort: number }) => ({
                id: i.id,
                sheet_id: i.sheet_id,
                criterion_id: i.criterion_id,
                criterion_name_snapshot: i.criterion_name_snapshot,
                weight_percentage_snapshot: i.weight_percentage_snapshot,
                is_quiz_criterion: i.is_quiz_criterion,
                score: i.score,
                sort: i.sort,
            }));
        } catch { return []; }
    },

    /**
     * Create a full interview grading flow: create sheet row → create items
     * (criterion snapshots) → PATCH sheet composite_score (guideline
     * SUM(score*weight)/100) → create interview row with explicit PH
     * created_at/updated_at (never DB CURRENT_TIMESTAMP).
     * @param input - Interview fields plus criterion snapshot items.
     * @returns The created interview record.
     */
    async createInterviewFlow(input: InterviewFlowInput): Promise<Interview> {
        try {
            const { items, recorded_by, ...interviewFields } = input;

            const sheetRes = await fetch(`${API_BASE_URL}/items/interview_score_sheet`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    application_id: input.application_id,
                    template_id: input.template_id ?? null,
                    stage: input.stage,
                    composite_score: 0,
                    recorded_by: recorded_by ?? input.interviewed_by ?? null,
                    recorded_at: nowPH(),
                }),
            });
            if (!sheetRes.ok) {
                const errorText = await sheetRes.text();
                console.error(`DIRECTUS ERROR [createInterviewFlow sheet]:`, errorText);
                throw new Error(`HTTP error! status: ${sheetRes.status}`);
            }
            const sheetJson = await sheetRes.json();
            const sheetId = sheetJson.data.id as number;

            const itemRows = items.map((item) => ({
                sheet_id: sheetId,
                criterion_id: item.criterion_id,
                criterion_name_snapshot: item.criterion_name_snapshot,
                weight_percentage_snapshot: item.weight_percentage_snapshot,
                is_quiz_criterion: item.is_quiz_criterion,
                score: item.score,
                sort: item.sort,
            }));
            const itemsRes = await fetch(`${API_BASE_URL}/items/interview_score_sheet_item`, {
                method: "POST",
                headers,
                body: JSON.stringify(itemRows),
            });
            if (!itemsRes.ok) {
                const errorText = await itemsRes.text();
                console.error(`DIRECTUS ERROR [createInterviewFlow items:${sheetId}]:`, errorText);
                throw new Error(`HTTP error! status: ${itemsRes.status}`);
            }

            const composite = computeComposite(items);
            const sheetPatchRes = await fetch(`${API_BASE_URL}/items/interview_score_sheet/${sheetId}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ composite_score: composite }),
            });
            if (!sheetPatchRes.ok) {
                const errorText = await sheetPatchRes.text();
                console.error(`DIRECTUS ERROR [createInterviewFlow sheet patch:${sheetId}]:`, errorText);
                throw new Error(`HTTP error! status: ${sheetPatchRes.status}`);
            }

            const interviewRes = await fetch(`${API_BASE_URL}/items/interview`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    ...interviewFields,
                    score_sheet_id: sheetId,
                    created_at: nowPH(),
                    updated_at: nowPH(),
                }),
            });
            if (!interviewRes.ok) {
                const errorText = await interviewRes.text();
                console.error(`DIRECTUS ERROR [createInterviewFlow interview]:`, errorText);
                throw new Error(`HTTP error! status: ${interviewRes.status}`);
            }
            const interviewJson = await interviewRes.json();
            return normalizeInterview(interviewJson.data);
        } catch (e) {
            console.error("Error creating interview flow:", e);
            throw new Error("VALIDATION_FAILED: Failed to submit interview grading");
        }
    },

    /**
     * Update an interview by ID, always stamping explicit PH updated_at
     * (never DB ON UPDATE CURRENT_TIMESTAMP).
     * @param id - Interview record ID.
     * @param patch - Partial interview fields to update.
     * @returns The updated interview record.
     */
    async updateInterview(id: number, patch: Partial<Interview>): Promise<Interview> {
        try {
            const response = await fetch(`${API_BASE_URL}/items/interview/${id}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ ...patch, updated_at: nowPH() }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [updateInterview:${id}]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return normalizeInterview(result.data);
        } catch (e) {
            console.error("Error updating interview:", e);
            throw new Error("VALIDATION_FAILED: Failed to update interview");
        }
    },

    /**
     * Delete an interview by ID with explicit ordered teardown:
     * sheet items → score sheet → interview row (never rely on cascade).
     * @param id - Interview record ID.
     */
    async removeInterview(id: number): Promise<void> {
        try {
            const getRes = await fetch(`${API_BASE_URL}/items/interview/${id}?fields=score_sheet_id`, { headers });
            if (!getRes.ok) {
                const errorText = await getRes.text();
                console.error(`DIRECTUS ERROR [removeInterview fetch:${id}]:`, errorText);
                throw new Error(`HTTP error! status: ${getRes.status}`);
            }
            const getJson = await getRes.json();
            const sheetId = getJson.data?.score_sheet_id as number | null;

            if (sheetId) {
                const delItemsRes = await fetch(
                    `${API_BASE_URL}/items/interview_score_sheet_item?filter[sheet_id][_eq]=${sheetId}`,
                    { method: "DELETE", headers }
                );
                if (!delItemsRes.ok) {
                    const errorText = await delItemsRes.text();
                    console.error(`DIRECTUS ERROR [removeInterview items:${sheetId}]:`, errorText);
                    throw new Error(`HTTP error! status: ${delItemsRes.status}`);
                }

                const delSheetRes = await fetch(`${API_BASE_URL}/items/interview_score_sheet/${sheetId}`, {
                    method: "DELETE",
                    headers,
                });
                if (!delSheetRes.ok) {
                    const errorText = await delSheetRes.text();
                    console.error(`DIRECTUS ERROR [removeInterview sheet:${sheetId}]:`, errorText);
                    throw new Error(`HTTP error! status: ${delSheetRes.status}`);
                }
            }

            const response = await fetch(`${API_BASE_URL}/items/interview/${id}`, {
                method: "DELETE",
                headers,
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [removeInterview:${id}]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (e) {
            console.error("Error deleting interview:", e);
            throw new Error("INTERNAL_FAIL: Failed to delete interview");
        }
    },
};

/**
 * Cast a raw Directus row to an Interview.
 * @param row - Raw Directus row.
 * @returns The normalized interview record.
 */
export function normalizeInterview(row: Record<string, unknown>): Interview {
    return row as unknown as Interview;
}
