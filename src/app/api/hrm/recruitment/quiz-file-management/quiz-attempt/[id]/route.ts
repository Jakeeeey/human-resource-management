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

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const attemptRes = await dFetch(`/items/quiz_attempt/${id}`);
        if (attemptRes.error || !attemptRes.data) {
            return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
        }

        const attempt = attemptRes.data;

        const [quizRes, applicantRes, answersRes] = await Promise.all([
            dFetch(`/items/quiz/${attempt.quiz_id}?fields=id,name`),
            dFetch(`/items/applicant/${attempt.applicant_id}`),
            dFetch(`/items/quiz_attempt_answer?filter[attempt_id][_eq]=${id}&limit=${LIMIT}&sort=id`),
        ]);

        return NextResponse.json({
            attempt: {
                ...attempt,
                quiz: quizRes?.data || null,
                applicant: applicantRes?.data || null,
            },
            answers: answersRes?.data || [],
        });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 }
        );
    }
}
