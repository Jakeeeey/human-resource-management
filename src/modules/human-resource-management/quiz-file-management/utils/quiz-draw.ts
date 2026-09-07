import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

const LIMIT = 1000;
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

export interface DrawnQuestion {
    id: number;
    question_type: string;
    question_text: string;
    question_image: string | null;
    choices: { id: number; option_text: string | null; option_image: string | null }[];
    blank_count: number;
}

export interface DrawnQuizBody {
    quiz: {
        id: number;
        name: string;
        number_of_questions: number;
        pass_threshold_value: number;
        time_limit_enabled: boolean;
        time_limit_minutes: number | null;
    };
    questions: DrawnQuestion[];
}

export type DrawResult =
    | { ok: true; body: DrawnQuizBody }
    | { ok: false; status: number; error: string };

function shuffleInPlace<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export async function drawQuizQuestions(quizId: string | number): Promise<DrawResult> {
    const quizRes = await dFetch(`/items/quiz/${quizId}`);
    const quiz: QuizRecord | undefined = quizRes?.data;
    if (!quiz) {
        return { ok: false, status: 404, error: "Quiz not found" };
    }
    if (quiz.status !== "active") {
        return {
            ok: false,
            status: 400,
            error: "This quiz isn't active. Set its status to Active in Quiz Management to run it.",
        };
    }
    if (!quiz.number_of_questions || quiz.number_of_questions < 1) {
        return {
            ok: false,
            status: 400,
            error: 'This quiz has no questions configured. Set "Number of Questions to Draw" to 1 or more.',
        };
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
        return {
            ok: false,
            status: 400,
            error: `This quiz needs ${quiz.number_of_questions} active questions${scopeNote}, but only ${pool.length} are currently available.`,
        };
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

    const questions: DrawnQuestion[] = orderedQuestions.map((q) => {
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

    return {
        ok: true,
        body: {
            quiz: {
                id: quiz.id,
                name: quiz.name,
                number_of_questions: quiz.number_of_questions,
                pass_threshold_value: quiz.pass_threshold_value,
                time_limit_enabled: quiz.time_limit_enabled,
                time_limit_minutes: quiz.time_limit_minutes,
            },
            questions,
        },
    };
}
