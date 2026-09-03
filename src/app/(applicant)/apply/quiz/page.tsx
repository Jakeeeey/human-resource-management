import { Suspense } from "react";
import { QuizTakingModule } from "@/modules/human-resource-management/quiz-file-management/quiz-taking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Chrome-less mount of the quiz-taking screen for the applicant continuity flow
 * (application form submit -> here). `returnHref` sends the "Done"/"Next" and
 * blocked-state buttons to the neutral completion screen rather than into the
 * HR app. This is the only mount of QuizTakingModule -- the old sidebar page
 * under /hrm was removed.
 */
export default function ApplyQuizPage() {
    return (
        <main className="min-h-dvh overflow-y-auto p-2 sm:p-4">
            <Suspense
                fallback={<div className="p-6 text-sm text-muted-foreground">Loading quiz...</div>}
            >
                <QuizTakingModule returnHref="/apply/done" />
            </Suspense>
        </main>
    );
}
