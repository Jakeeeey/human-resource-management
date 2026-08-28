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

const CHOICE_TYPES = new Set(["true_false", "multiple_choice"]);

interface QuizQuestionRecord {
    id: number;
    question_type: string;
    question_text: string;
    sort: number | null;
    created_at: string;
    [key: string]: unknown;
}

interface QuizQuestionChoiceRecord {
    id: number;
    question_id: number;
    option_text: string | null;
    option_image: string | null;
    is_correct: boolean;
    sort: number | null;
    [key: string]: unknown;
}

interface QuizQuestionExpectedAnswerRecord {
    id: number;
    question_id: number;
    blank_index: number;
    expected_answer_text: string;
    [key: string]: unknown;
}

interface OptionInput {
    option_text: string;
    option_image?: string | null;
    is_correct: boolean;
}

interface ExpectedAnswerBlankInput {
    answers: string[];
}

async function createAnswerRows(
    questionId: number,
    questionType: string,
    options: OptionInput[],
    expectedAnswers: ExpectedAnswerBlankInput[]
) {
    if (CHOICE_TYPES.has(questionType)) {
        if (!Array.isArray(options) || !options.length) return;
        await Promise.all(
            options.map((opt, index) =>
                dFetch(`/items/quiz_question_choice`, {
                    method: "POST",
                    body: JSON.stringify({
                        question_id: questionId,
                        option_text: opt.option_text?.trim() || null,
                        option_image: opt.option_image ?? null,
                        is_correct: opt.is_correct,
                        sort: index,
                    }),
                })
            )
        );
        return;
    }

    if (!Array.isArray(expectedAnswers) || !expectedAnswers.length) return;

    const rows: { question_id: number; blank_index: number; expected_answer_text: string }[] = [];
    expectedAnswers.forEach((blank, blankIndex) => {
        (blank.answers || [])
            .map((a) => a.trim())
            .filter(Boolean)
            .forEach((answerText) => {
                rows.push({ question_id: questionId, blank_index: blankIndex, expected_answer_text: answerText });
            });
    });

    await Promise.all(
        rows.map((row) =>
            dFetch(`/items/quiz_question_expected_answer`, {
                method: "POST",
                body: JSON.stringify(row),
            })
        )
    );
}

async function deleteAnswerRows(questionId: number) {
    const [choicesRes, expectedRes] = await Promise.all([
        dFetch(`/items/quiz_question_choice?filter[question_id][_eq]=${questionId}&limit=${LIMIT}`),
        dFetch(`/items/quiz_question_expected_answer?filter[question_id][_eq]=${questionId}&limit=${LIMIT}`),
    ]);

    const choices: QuizQuestionChoiceRecord[] = choicesRes?.data || [];
    const expected: QuizQuestionExpectedAnswerRecord[] = expectedRes?.data || [];

    await Promise.all([
        ...choices.map((c) => dFetch(`/items/quiz_question_choice/${c.id}`, { method: "DELETE" })),
        ...expected.map((e) => dFetch(`/items/quiz_question_expected_answer/${e.id}`, { method: "DELETE" })),
    ]);
}

export async function GET(req: NextRequest) {
    try {
        const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";
        const activeFilter = includeInactive ? "" : "&filter[is_active][_eq]=true";

        const [questionsRes, choicesRes, expectedRes] = await Promise.all([
            dFetch(`/items/quiz_question?limit=${LIMIT}&sort=-created_at${activeFilter}`),
            dFetch(`/items/quiz_question_choice?limit=${LIMIT}`),
            dFetch(`/items/quiz_question_expected_answer?limit=${LIMIT}`),
        ]);

        if (questionsRes.error || choicesRes.error || expectedRes.error) {
            return NextResponse.json(
                { error: questionsRes.error || choicesRes.error || expectedRes.error },
                { status: 500 }
            );
        }

        const questions: QuizQuestionRecord[] = questionsRes.data || [];
        const choices: QuizQuestionChoiceRecord[] = choicesRes.data || [];
        const expected: QuizQuestionExpectedAnswerRecord[] = expectedRes.data || [];

        const enriched = questions.map((q) => {
            const ownChoices = choices
                .filter((c) => c.question_id === q.id)
                .sort((a, b) => (a.sort ?? a.id) - (b.sort ?? b.id))
                .map((c) => ({
                    id: c.id,
                    question_id: c.question_id,
                    option_text: c.option_text,
                    option_image: c.option_image,
                    is_correct: c.is_correct,
                    sort: c.sort,
                }));

            const ownExpectedRows = expected
                .filter((e) => e.question_id === q.id)
                .sort((a, b) => a.blank_index - b.blank_index || a.id - b.id);

            const ownExpectedFlat = ownExpectedRows.map((e) => ({
                id: e.id,
                question_id: e.question_id,
                option_text: e.expected_answer_text,
                option_image: null,
                is_correct: true,
                sort: e.blank_index,
            }));

            const maxBlankIndex = ownExpectedRows.reduce((max, e) => Math.max(max, e.blank_index), -1);
            const expectedAnswersByBlank: string[][] = Array.from({ length: maxBlankIndex + 1 }, () => []);
            ownExpectedRows.forEach((e) => {
                expectedAnswersByBlank[e.blank_index].push(e.expected_answer_text);
            });

            return {
                ...q,
                options: [...ownChoices, ...ownExpectedFlat],
                expectedAnswersByBlank,
            };
        });

        return NextResponse.json({ questions: enriched });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { options, expectedAnswers, ...questionData } = body as {
        options: OptionInput[];
        expectedAnswers: ExpectedAnswerBlankInput[];
        question_type: string;
        [key: string]: unknown;
    };

    const created = await dFetch(`/items/quiz_question`, {
        method: "POST",
        body: JSON.stringify(questionData),
    });

    const questionId = created?.data?.id;

    if (questionId) {
        await createAnswerRows(questionId, questionData.question_type, options, expectedAnswers);
    }

    return NextResponse.json({ success: true, data: created?.data });
}

export async function PATCH(req: NextRequest) {
    const body = await req.json();
    const { id, options, expectedAnswers, ...questionData } = body as {
        id: number;
        options: OptionInput[];
        expectedAnswers: ExpectedAnswerBlankInput[];
        question_type: string;
        [key: string]: unknown;
    };

    await dFetch(`/items/quiz_question/${id}`, {
        method: "PATCH",
        body: JSON.stringify(questionData),
    });

    if (Array.isArray(options) || Array.isArray(expectedAnswers)) {
        await deleteAnswerRows(id);
        await createAnswerRows(id, questionData.question_type, options, expectedAnswers);
    }

    return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
        return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await dFetch(`/items/quiz_question/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: false }),
    });

    return NextResponse.json({ success: true });
}
