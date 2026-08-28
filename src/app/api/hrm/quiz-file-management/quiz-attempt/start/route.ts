import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";

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

const CHOICE_TYPES = new Set(["true_false", "multiple_choice"]);

interface QuizRecord {
    id: number;
    name: string;
    status: string;
    number_of_questions: number;
    pass_threshold_value: number;
    time_limit_enabled: boolean;
    time_limit_minutes: number | null;
    shuffle_questions: boolean;
    shuffle_answers: boolean;
}

interface QuestionRecord {
    id: number;
    question_type: string;
    question_text: string;
    question_image: string | null;
    sort: number | null;
    created_at: string;
}

interface ChoiceRecord {
    id: number;
    question_id: number;
    option_text: string | null;
    option_image: string | null;
    sort: number | null;
}

interface ExpectedAnswerKeyRecord {
    question_id: number;
    blank_index: number;
}

function shuffleInPlace<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export async function GET(req: NextRequest) {
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    const payload = token ? decodeJwtPayload(token) : null;
    if (!payload) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const quizId = req.nextUrl.searchParams.get("quiz_id");
        if (!quizId) {
            return NextResponse.json({ error: "quiz_id is required" }, { status: 400 });
        }

        const quizRes = await dFetch(`/items/quiz/${quizId}`);
        const quiz: QuizRecord | undefined = quizRes?.data;
        if (!quiz) {
            return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
        }
        if (quiz.status !== "active") {
            return NextResponse.json(
                { error: "This quiz isn't active. Set its status to Active in Quiz Management to run it." },
                { status: 400 }
            );
        }
        if (!quiz.number_of_questions || quiz.number_of_questions < 1) {
            return NextResponse.json(
                {
                    error:
                        'This quiz has no questions configured. Set "Number of Questions to Draw" to 1 or more.',
                },
                { status: 400 }
            );
        }

        const [questionsRes, categoryFilterRes] = await Promise.all([
            dFetch(
                `/items/quiz_question?filter[is_active][_eq]=true&limit=${LIMIT}&fields=id,question_type,question_text,question_image,category,sort,created_at`
            ),
            dFetch(
                `/items/quiz_category_filter?filter[quiz_id][_eq]=${quizId}&limit=${LIMIT}&fields=category`
            ),
        ]);
        const allActive: (QuestionRecord & { category: string | null })[] = questionsRes?.data || [];
        const categoryFilter: string[] = (categoryFilterRes?.data || []).map(
            (row: { category: string }) => row.category
        );

        const pool = categoryFilter.length
            ? allActive.filter((q) => q.category != null && categoryFilter.includes(q.category))
            : allActive;

        if (pool.length < quiz.number_of_questions) {
            const scopeNote = categoryFilter.length
                ? ` in the "${categoryFilter.join(", ")}" categor${categoryFilter.length > 1 ? "ies" : "y"}`
                : "";
            return NextResponse.json(
                {
                    error: `This quiz needs ${quiz.number_of_questions} active questions${scopeNote}, but only ${pool.length} are currently available.`,
                },
                { status: 400 }
            );
        }

        const drawn = shuffleInPlace([...pool]).slice(0, quiz.number_of_questions);
        const orderedQuestions = quiz.shuffle_questions
            ? drawn
            : [...drawn].sort(
                  (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.created_at.localeCompare(b.created_at)
              );

        const drawnIds = new Set(orderedQuestions.map((q) => q.id));
        const idList = [...drawnIds].join(",");

        const [choicesRes, expectedRes] = await Promise.all([
            dFetch(
                `/items/quiz_question_choice?filter[question_id][_in]=${idList}&limit=${LIMIT}&fields=id,question_id,option_text,option_image,sort`
            ),
            dFetch(
                `/items/quiz_question_expected_answer?filter[question_id][_in]=${idList}&limit=${LIMIT}&fields=question_id,blank_index`
            ),
        ]);

        const choicesByQuestionId = new Map<number, ChoiceRecord[]>();
        for (const c of (choicesRes?.data || []) as ChoiceRecord[]) {
            const list = choicesByQuestionId.get(c.question_id) || [];
            list.push(c);
            choicesByQuestionId.set(c.question_id, list);
        }

        const maxBlankIndexByQuestionId = new Map<number, number>();
        for (const e of (expectedRes?.data || []) as ExpectedAnswerKeyRecord[]) {
            const current = maxBlankIndexByQuestionId.get(e.question_id) ?? -1;
            if (e.blank_index > current) {
                maxBlankIndexByQuestionId.set(e.question_id, e.blank_index);
            }
        }

        const questions = orderedQuestions.map((q) => {
            const isChoiceType = CHOICE_TYPES.has(q.question_type);

            const rawChoices = (choicesByQuestionId.get(q.id) || [])
                .sort((a, b) => (a.sort ?? a.id) - (b.sort ?? b.id))
                .map((c) => ({ id: c.id, option_text: c.option_text, option_image: c.option_image }));
            const choices = quiz.shuffle_answers ? shuffleInPlace([...rawChoices]) : rawChoices;

            const maxBlankIndex = maxBlankIndexByQuestionId.get(q.id) ?? -1;
            const blankCount = isChoiceType ? 0 : maxBlankIndex + 1;

            return {
                id: q.id,
                question_type: q.question_type,
                question_text: q.question_text,
                question_image: q.question_image,
                choices: isChoiceType ? choices : [],
                blank_count: blankCount,
            };
        });

        return NextResponse.json({
            quiz: {
                id: quiz.id,
                name: quiz.name,
                number_of_questions: quiz.number_of_questions,
                pass_threshold_value: quiz.pass_threshold_value,
                time_limit_enabled: quiz.time_limit_enabled,
                time_limit_minutes: quiz.time_limit_minutes,
            },
            questions,
        });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 }
        );
    }
}
