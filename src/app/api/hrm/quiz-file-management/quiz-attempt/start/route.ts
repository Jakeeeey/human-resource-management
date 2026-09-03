import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";
import { drawQuizQuestions } from "@/lib/quiz-file-management/quiz-draw";

// HR-desktop flow: an authenticated HR user starts a specific quiz for an
// applicant. The question-draw itself is shared with the mobile-applicant-quiz
// route via drawQuizQuestions().
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

        const result = await drawQuizQuestions(quizId);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }
        return NextResponse.json(result.body);
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 }
        );
    }
}
