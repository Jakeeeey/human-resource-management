import { NextRequest, NextResponse } from "next/server";

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

async function replaceCategoryFilterRows(quizId: number, categories: string[]) {
    const existingRes = await dFetch(
        `/items/quiz_category_filter?filter[quiz_id][_eq]=${quizId}&limit=${LIMIT}`
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
                body: JSON.stringify({ quiz_id: quizId, category }),
            })
        )
    );
}

export async function GET() {
    try {
        const quizzesRes = await dFetch(`/items/quiz?limit=${LIMIT}&sort=-created_at`);

        if (quizzesRes.error) {
            return NextResponse.json({ error: quizzesRes.error }, { status: 500 });
        }

        const quizzes: { id: number; [key: string]: unknown }[] = quizzesRes.data || [];
        if (!quizzes.length) {
            return NextResponse.json({ quizzes: [] });
        }

        const quizIds = quizzes.map((q) => q.id);
        const filtersRes = await dFetch(
            `/items/quiz_category_filter?filter[quiz_id][_in]=${quizIds.join(",")}&limit=${LIMIT}`
        );
        const categoriesByQuizId = new Map<number, string[]>();
        for (const row of (filtersRes?.data || []) as CategoryFilterRow[]) {
            const list = categoriesByQuizId.get(row.quiz_id) || [];
            list.push(row.category);
            categoriesByQuizId.set(row.quiz_id, list);
        }

        const enriched = quizzes.map((q) => ({
            ...q,
            category_filter: categoriesByQuizId.get(q.id) || [],
        }));

        return NextResponse.json({ quizzes: enriched });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { category_filter, ...quizData } = body as {
        category_filter?: string[];
        [key: string]: unknown;
    };

    const created = await dFetch(`/items/quiz`, {
        method: "POST",
        body: JSON.stringify(quizData),
    });

    const quizId = created?.data?.id;
    if (quizId && Array.isArray(category_filter) && category_filter.length) {
        await replaceCategoryFilterRows(quizId, category_filter);
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

    await dFetch(`/items/quiz/${id}`, {
        method: "PATCH",
        body: JSON.stringify(rest),
    });

    if (Array.isArray(category_filter)) {
        await replaceCategoryFilterRows(id, category_filter);
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
                error: `This quiz has ${attemptCount} recorded attempt(s) and can't be deleted. Archive it instead to keep it out of use while preserving the history.`,
                hasAttempts: true,
            },
            { status: 409 }
        );
    }

    await dFetch(`/items/quiz/${id}`, { method: "DELETE" });

    return NextResponse.json({ success: true });
}
