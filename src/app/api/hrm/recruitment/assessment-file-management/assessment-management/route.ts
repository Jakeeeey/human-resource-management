import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";
import { actorIdFromJwt, nowUTC, stampCreate, stampUpdate } from "@/modules/human-resource-management/recruitment/assessment-file-management/utils/audit";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const LIMIT = 1000;

const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

async function dFetch(path: string, options?: RequestInit) {
    const res = await fetch(`${DIRECTUS_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${STATIC_TOKEN}`,
            ...(options?.headers || {}),
        },
    });

    if (!res.ok) {
        const text = await res.text();
        console.error("DIRECTUS ERROR:", text);
        try {
            return JSON.parse(text);
        } catch {
            throw new Error(text);
        }
    }

    if (res.status === 204) {
        return null;
    }

    return res.json();
}

interface CategoryFilterRow {
    id: number;
    quiz_id: number;
    category: string;
}

async function replaceCategoryFilterRows(assessmentId: number, categories: string[]) {
    const existingRes = await dFetch(
        `/items/quiz_category_filter?filter[quiz_id][_eq]=${assessmentId}&limit=${LIMIT}`
    );
    const existing: CategoryFilterRow[] = existingRes?.data || [];
    await Promise.all(
        existing.map((row) => dFetch(`/items/quiz_category_filter/${row.id}`, { method: "DELETE" }))
    );

    if (!categories.length) return;
    await Promise.all(
        categories.map((category) =>
            dFetch(`/items/quiz_category_filter`, {
                method: "POST",
                body: JSON.stringify({ quiz_id: assessmentId, category }),
            })
        )
    );
}

async function countActivePool(categoryFilter: string[]): Promise<number> {
    const res = await dFetch(
        `/items/quiz_question?filter[is_active][_eq]=true&limit=${LIMIT}&fields=category`
    );
    const rows: { category: string | null }[] = res?.data || [];
    return categoryFilter.length
        ? rows.filter((r) => r.category != null && categoryFilter.includes(r.category)).length
        : rows.length;
}

async function validateApplicantAssessmentFlag(
    status: string,
    numberOfQuestions: number,
    categoryFilter: string[]
): Promise<string | null> {
    if (status !== "active") {
        return "Only an Active assessment can be the applicant assessment. Set this assessment's status to Active first.";
    }
    const poolSize = await countActivePool(categoryFilter);
    if (poolSize < numberOfQuestions) {
        const scope = categoryFilter.length ? " in the selected categories" : "";
        return `This assessment draws ${numberOfQuestions} questions but only ${poolSize} active question(s)${scope} are available. Add more questions or lower "Number of Questions to Draw" before making it the applicant assessment.`;
    }
    return null;
}

async function clearApplicantAssessmentFlagOnOthers(exceptId: number) {
    const res = await dFetch(`/items/quiz?limit=${LIMIT}&fields=id,is_applicant_quiz`);
    const others = ((res?.data || []) as { id: number; is_applicant_quiz: unknown }[]).filter(
        (q) => q.id !== exceptId && (q.is_applicant_quiz === true || q.is_applicant_quiz === 1)
    );
    await Promise.all(
        others.map((q) =>
            dFetch(`/items/quiz/${q.id}`, {
                method: "PATCH",
                body: JSON.stringify({ is_applicant_quiz: false, updated_at: nowUTC() }),
            })
        )
    );
}

export async function GET() {
    try {
        const assessmentsRes = await dFetch(`/items/quiz?limit=${LIMIT}&sort=-created_at`);

        if (assessmentsRes.error) {
            return NextResponse.json({ error: assessmentsRes.error }, { status: 500 });
        }

        const assessments: { id: number; [key: string]: unknown }[] = assessmentsRes.data || [];
        if (!assessments.length) {
            return NextResponse.json({ assessments: [] });
        }

        const assessmentIds = assessments.map((q) => q.id);
        const filtersRes = await dFetch(
            `/items/quiz_category_filter?filter[quiz_id][_in]=${assessmentIds.join(",")}&limit=${LIMIT}`
        );
        const categoriesByAssessmentId = new Map<number, string[]>();
        for (const row of (filtersRes?.data || []) as CategoryFilterRow[]) {
            const list = categoriesByAssessmentId.get(row.quiz_id) || [];
            list.push(row.category);
            categoriesByAssessmentId.set(row.quiz_id, list);
        }

        const enriched = assessments.map((q) => ({
            ...q,
            category_filter: categoriesByAssessmentId.get(q.id) || [],
        }));

        return NextResponse.json({ assessments: enriched });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { category_filter, ...assessmentData } = body as {
        category_filter?: string[];
        [key: string]: unknown;
    };

    if (assessmentData.is_applicant_quiz) {
        const err = await validateApplicantAssessmentFlag(
            String(assessmentData.status ?? ""),
            Number(assessmentData.number_of_questions ?? 0),
            category_filter ?? []
        );
        if (err) {
            return NextResponse.json({ error: err }, { status: 400 });
        }
    }

    const token = (await cookies()).get(COOKIE_NAME)?.value;
    const payload = token ? decodeJwtPayload(token) : null;
    const actorId = actorIdFromJwt(payload);

    const now = nowUTC();
    const created = await dFetch(`/items/quiz`, {
        method: "POST",
        body: JSON.stringify(stampCreate({ ...assessmentData, created_at: now, updated_at: now }, actorId)),
    });

    const assessmentId = created?.data?.id;
    if (assessmentId && Array.isArray(category_filter) && category_filter.length) {
        await replaceCategoryFilterRows(assessmentId, category_filter);
    }

    if (assessmentId && assessmentData.is_applicant_quiz) {
        await clearApplicantAssessmentFlagOnOthers(assessmentId);
    }

    return NextResponse.json({ success: true, data: created?.data });
}

export async function PATCH(req: NextRequest) {
    const body = await req.json();
    const { id, category_filter, ...rest } = body as {
        id: number;
        category_filter?: string[];
        [key: string]: unknown;
    };

    if (rest.status !== undefined && rest.status !== "active") {
        rest.is_applicant_quiz = false;
    }

    if (rest.is_applicant_quiz) {
        const currentRes = await dFetch(
            `/items/quiz/${id}?fields=status,number_of_questions`
        );
        const current = currentRes?.data || {};
        const effectiveStatus = String(rest.status ?? current.status ?? "");
        const effectiveCount = Number(
            rest.number_of_questions ?? current.number_of_questions ?? 0
        );
        let effectiveCategories = category_filter;
        if (!Array.isArray(effectiveCategories)) {
            const catRes = await dFetch(
                `/items/quiz_category_filter?filter[quiz_id][_eq]=${id}&limit=${LIMIT}&fields=category`
            );
            effectiveCategories = (catRes?.data || []).map(
                (r: { category: string }) => r.category
            );
        }
        const err = await validateApplicantAssessmentFlag(
            effectiveStatus,
            effectiveCount,
            effectiveCategories ?? []
        );
        if (err) {
            return NextResponse.json({ error: err }, { status: 400 });
        }
    }

    const token = (await cookies()).get(COOKIE_NAME)?.value;
    const payload = token ? decodeJwtPayload(token) : null;
    const actorId = actorIdFromJwt(payload);

    await dFetch(`/items/quiz/${id}`, {
        method: "PATCH",
        body: JSON.stringify(stampUpdate({ ...rest, updated_at: nowUTC() }, actorId)),
    });

    if (Array.isArray(category_filter)) {
        await replaceCategoryFilterRows(id, category_filter);
    }

    if (rest.is_applicant_quiz) {
        await clearApplicantAssessmentFlagOnOthers(id);
    }

    return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
        return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const attemptsRes = await dFetch(
        `/items/quiz_attempt?filter[quiz_id][_eq]=${id}&aggregate[count]=*`
    );
    const attemptCount = Number(attemptsRes?.data?.[0]?.count ?? 0);

    if (attemptCount > 0) {
        return NextResponse.json(
            {
                error: `This assessment has ${attemptCount} recorded attempt(s) and can't be deleted. Archive it instead to keep it out of use while preserving the history.`,
                hasAttempts: true,
            },
            { status: 409 }
        );
    }

    await dFetch(`/items/quiz/${id}`, { method: "DELETE" });

    return NextResponse.json({ success: true });
}
