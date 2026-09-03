"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { QuestionCard } from "./components/QuestionCard";
import { ResultScreen } from "./components/ResultScreen";
import type { AnswersByQuestionId, StartQuizResponse, SubmitAnswerPayload } from "./types";
import type { QuizAttempt, QuizAttemptDetail } from "@/modules/human-resource-management/quiz-file-management/quiz-history/types";

type Step = "loading" | "blocked" | "in-progress" | "submitting" | "result";

const CHOICE_TYPES = new Set(["true_false", "multiple_choice"]);

function buildSubmitAnswers(
    questions: StartQuizResponse["questions"],
    answers: AnswersByQuestionId
): SubmitAnswerPayload[] {
    const payload: SubmitAnswerPayload[] = [];
    for (const q of questions) {
        const given = answers[q.id] || [];
        if (CHOICE_TYPES.has(q.question_type)) {
            // given[0] holds the picked choice id as a string.
            const picked = given[0] ? Number(given[0]) : null;
            payload.push({
                question_id: q.id,
                answer_given_choice_id: picked != null && !Number.isNaN(picked) ? picked : null,
                presented_choice_ids: q.choices.map((c) => c.id),
            });
            continue;
        }
        const blankCount = q.blank_count || 1;
        for (let i = 0; i < blankCount; i++) {
            payload.push({ question_id: q.id, blank_index: i, answer_given_text: given[i] || "" });
        }
    }
    return payload;
}

interface QuizTakingModuleProps {
    // Where "back"/"next candidate"/blocked-state buttons return to. The
    // HR-desktop mount keeps the default; the chrome-less /apply/quiz mount
    // passes a neutral completion route so the applicant never lands in the
    // HR app.
    returnHref?: string;
}

export default function QuizTakingModule({
    returnHref = "/hrm/quiz-file-management/quiz-management",
}: QuizTakingModuleProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const quizId = searchParams.get("quiz_id");
    const applicantId = searchParams.get("applicant_id");
    const applicationId = searchParams.get("application_id");

    const [step, setStep] = useState<Step>("loading");
    const [blockedMessage, setBlockedMessage] = useState("");
    const [data, setData] = useState<StartQuizResponse | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<AnswersByQuestionId>({});
    const [startedAt, setStartedAt] = useState<string | null>(null);
    const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
    const [result, setResult] = useState<QuizAttempt | null>(null);
    const isSubmittingRef = useRef(false);

    // Navigation guard: intercepted sidebar/link clicks and the Back button
    // stash their target here and raise the in-app confirm dialog.
    const [pendingNav, setPendingNav] = useState<
        { kind: "link"; href: string } | { kind: "back" } | null
    >(null);
    const bypassPopRef = useRef(false);

    useEffect(() => {
        if (!quizId) {
            setBlockedMessage("No quiz selected.");
            setStep("blocked");
            return;
        }
        (async () => {
            try {
                const res = await fetch(`/api/hrm/quiz-file-management/quiz-attempt/start?quiz_id=${quizId}`);
                const body = await res.json();
                if (!res.ok) {
                    setBlockedMessage(body.error || "This quiz can't be started right now.");
                    setStep("blocked");
                    return;
                }
                if (!body.questions || body.questions.length === 0) {
                    setBlockedMessage("This quiz has no questions available right now.");
                    setStep("blocked");
                    return;
                }
                setData(body);
                if (body.quiz.time_limit_enabled && body.quiz.time_limit_minutes) {
                    setSecondsRemaining(body.quiz.time_limit_minutes * 60);
                }
                setStartedAt(new Date().toISOString());
                setStep("in-progress");
            } catch {
                setBlockedMessage("Failed to load the quiz. Please try again.");
                setStep("blocked");
            }
        })();
    }, [quizId]);

    const handleSubmit = useCallback(async () => {
        if (isSubmittingRef.current || !data || !quizId || !applicantId) return;
        isSubmittingRef.current = true;
        setStep("submitting");

        try {
            const submitRes = await fetch("/api/hrm/quiz-file-management/quiz-attempt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    quiz_id: Number(quizId),
                    applicant_id: Number(applicantId),
                    application_id: applicationId ? Number(applicationId) : null,
                    started_at: startedAt,
                    answers: buildSubmitAnswers(data.questions, answers),
                }),
            });
            const submitBody = await submitRes.json();
            if (!submitRes.ok) throw new Error(submitBody.error || "Submit failed");

            const attemptId = submitBody.data.id;
            const detailRes = await fetch(`/api/hrm/quiz-file-management/quiz-attempt/${attemptId}`);
            const detail: QuizAttemptDetail = await detailRes.json();

            setResult(detail.attempt);
            setStep("result");
        } catch {
            isSubmittingRef.current = false;
            setBlockedMessage("Failed to submit the quiz. Please try again.");
            setStep("blocked");
        }
    }, [data, quizId, applicantId, applicationId, startedAt, answers]);

    // Countdown timer -- auto-submits the moment it hits zero.
    useEffect(() => {
        if (step !== "in-progress" || secondsRemaining == null) return;
        if (secondsRemaining <= 0) {
            handleSubmit();
            return;
        }
        const t = setTimeout(() => setSecondsRemaining((s) => (s == null ? s : s - 1)), 1000);
        return () => clearTimeout(t);
    }, [step, secondsRemaining, handleSubmit]);

    useEffect(() => {
        if (step !== "in-progress") return;
        function handler(e: BeforeUnloadEvent) {
            e.preventDefault();
        }
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [step]);

    const confirmLeave = useCallback(() => {
        const nav = pendingNav;
        setPendingNav(null);
        if (!nav) return;
        if (nav.kind === "link") {
            router.push(nav.href);
        } else {
            bypassPopRef.current = true;
            window.history.back();
        }
    }, [pendingNav, router]);

    const cancelLeave = useCallback(() => setPendingNav(null), []);

    useEffect(() => {
        if (step !== "in-progress") return;

        function handleClick(e: MouseEvent) {
            const link = (e.target as HTMLElement).closest("a");
            const href = link?.getAttribute("href");
            if (!href || href.startsWith("#")) return;
            e.preventDefault();
            setPendingNav({ kind: "link", href });
        }
        document.addEventListener("click", handleClick, { capture: true });

        // Trap the Back button: seed an extra history entry, and on each
        // popstate re-seed it (staying put) while the proctor is asked.
        window.history.pushState(null, "", window.location.href);
        function handlePopState() {
            if (bypassPopRef.current) {
                bypassPopRef.current = false;
                return; // proctor chose "End attempt" -- let this navigation through
            }
            window.history.pushState(null, "", window.location.href);
            setPendingNav({ kind: "back" });
        }
        window.addEventListener("popstate", handlePopState);

        return () => {
            document.removeEventListener("click", handleClick, { capture: true });
            window.removeEventListener("popstate", handlePopState);
        };
    }, [step]);

    if (step === "loading") {
        return <div className="text-sm text-muted-foreground">Preparing your quiz...</div>;
    }

    if (step === "blocked") {
        return (
            <div className="mx-auto max-w-md space-y-4 py-8">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Can&apos;t Start Quiz</AlertTitle>
                    <AlertDescription>{blockedMessage}</AlertDescription>
                </Alert>
                <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push(returnHref)}
                >
                    Done
                </Button>
            </div>
        );
    }

    if (step === "submitting") {
        return <div className="text-sm text-muted-foreground">Submitting your answers...</div>;
    }

    if (step === "result" && result) {
        return (
            <ResultScreen
                attempt={result}
                onNextCandidate={() => router.push(returnHref)}
            />
        );
    }

    if (!data) return null;

    const question = data.questions[currentIndex];
    const isLast = currentIndex === data.questions.length - 1;

    return (
        <div className="mx-auto max-w-2xl space-y-6 py-4">
            <QuestionCard
                question={question}
                index={currentIndex}
                total={data.questions.length}
                timeRemainingSeconds={secondsRemaining}
                value={answers[question.id] || []}
                onChange={(next) => setAnswers((prev) => ({ ...prev, [question.id]: next }))}
            />

            <div className="flex justify-between">
                <Button
                    variant="outline"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                >
                    Back
                </Button>
                {isLast ? (
                    <Button onClick={handleSubmit}>Submit</Button>
                ) : (
                    <Button onClick={() => setCurrentIndex((i) => i + 1)}>Next</Button>
                )}
            </div>

            <AlertDialog
                open={pendingNav !== null}
                onOpenChange={(open) => {
                    if (!open) cancelLeave();
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>End this quiz attempt?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The applicant&apos;s answers so far won&apos;t be saved.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={cancelLeave}>Keep taking</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={confirmLeave}>
                            End attempt
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
