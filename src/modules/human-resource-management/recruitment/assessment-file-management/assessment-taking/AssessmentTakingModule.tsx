"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { QuestionCard } from "./components/QuestionCard";
import { AssessmentBlockedState, type AssessmentBlockedVariant } from "./components/AssessmentBlockedState";
import { LeaveConfirmDialog } from "./components/LeaveConfirmDialog";
import { SubmitConfirmDialog } from "./components/SubmitConfirmDialog";
import { useAssessmentLeaveGuard } from "./hooks/useAssessmentLeaveGuard";
import type { AnswersByQuestionId, StartAssessmentResponse } from "./types";
import { buildSubmitAnswers, isQuestionAnswered } from "./utils/answers";

type Step = "loading" | "blocked" | "in-progress" | "submitting";

interface AssessmentTakingModuleProps {
    returnHref?: string;
    exitHref?: string;
    exitLabel?: string;
}

export default function AssessmentTakingModule({
    returnHref = "/hrm/recruitment/assessment-file-management/assessment-management",
    exitHref = "/hrm/recruitment/assessment-file-management/assessment-management",
    exitLabel = "Return to HR",
}: AssessmentTakingModuleProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const assessmentId = searchParams.get("quiz_id");
    const applicantId = searchParams.get("applicant_id");
    const applicationId = searchParams.get("application_id");

    const [step, setStep] = useState<Step>("loading");
    const [blockedMessage, setBlockedMessage] = useState("");
    const [blockedVariant, setBlockedVariant] = useState<AssessmentBlockedVariant>("start");
    const [data, setData] = useState<StartAssessmentResponse | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<AnswersByQuestionId>({});
    const [startedAt, setStartedAt] = useState<string | null>(null);
    const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
    const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
    const isSubmittingRef = useRef(false);
    const warnedRef = useRef(false);

    const { pendingNav, confirmLeave, clearPending } = useAssessmentLeaveGuard(step === "in-progress");

    useEffect(() => {
        if (!assessmentId) {
            setBlockedVariant("start");
            setBlockedMessage("No assessment selected.");
            setStep("blocked");
            return;
        }
        (async () => {
            try {
                const res = await fetch(`/api/hrm/recruitment/assessment-file-management/assessment-attempt/start?quiz_id=${assessmentId}`);
                const body = await res.json();
                if (!res.ok) {
                    setBlockedVariant("start");
                    setBlockedMessage(body.error || "This assessment can't be started right now.");
                    setStep("blocked");
                    return;
                }
                if (!body.questions || body.questions.length === 0) {
                    setBlockedVariant("start");
                    setBlockedMessage("This assessment has no questions available right now.");
                    setStep("blocked");
                    return;
                }
                setData(body);
                if (body.assessment.time_limit_enabled && body.assessment.time_limit_minutes) {
                    setSecondsRemaining(body.assessment.time_limit_minutes * 60);
                }
                setStartedAt(new Date().toISOString());
                setStep("in-progress");
            } catch {
                setBlockedVariant("start");
                setBlockedMessage("Failed to load the assessment. Please try again.");
                setStep("blocked");
            }
        })();
    }, [assessmentId]);

    const handleSubmit = useCallback(async () => {
        if (isSubmittingRef.current || !data || !assessmentId || !applicantId) return;
        isSubmittingRef.current = true;
        setStep("submitting");

        try {
            const submitRes = await fetch("/api/hrm/recruitment/assessment-file-management/assessment-attempt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    quiz_id: Number(assessmentId),
                    applicant_id: Number(applicantId),
                    application_id: applicationId ? Number(applicationId) : null,
                    started_at: startedAt,
                    answers: buildSubmitAnswers(data.questions, answers),
                }),
            });
            const submitBody = await submitRes.json();
            if (!submitRes.ok) throw new Error(submitBody.error || "Submit failed");

            // NOTE: attempt detail is deliberately NOT fetched here — it carries
            // correct answers, which must never reach the applicant's browser.
            // Only display-safe scalars travel on as query params to the done
            // screen (score, pass flag, assessment name, totals) — never answers.
            const params = new URLSearchParams({
                score: String(submitBody.data?.score ?? submitBody.data?.percentage_score ?? ""),
                passed: String(submitBody.data?.passed ?? ""),
                assessment: data.assessment.name,
                total: String(data.questions.length),
                threshold: String(data.assessment.pass_threshold_value),
            });
            router.push(`${returnHref}?${params.toString()}`);
        } catch {
            isSubmittingRef.current = false;
            setBlockedVariant("submit");
            setBlockedMessage(
                "We couldn't submit your answers. Your responses are still here — retry the submission."
            );
            setStep("blocked");
        }
    }, [data, assessmentId, applicantId, applicationId, startedAt, answers, router, returnHref]);

    useEffect(() => {
        if (step !== "in-progress" || secondsRemaining == null) return;
        if (secondsRemaining <= 0) {
            handleSubmit();
            return;
        }
        const t = setTimeout(() => setSecondsRemaining((s) => (s == null ? s : s - 1)), 1000);
        return () => clearTimeout(t);
    }, [step, secondsRemaining, handleSubmit]);

    // One-time heads-up before the timer auto-submits (error prevention).
    useEffect(() => {
        if (step !== "in-progress" || secondsRemaining == null) return;
        if (secondsRemaining > 0 && secondsRemaining <= 60 && !warnedRef.current) {
            warnedRef.current = true;
            toast.warning("1 minute left", {
                description: "Your assessment will submit automatically when time runs out.",
            });
        }
    }, [step, secondsRemaining]);

    const answeredFlags = data
        ? data.questions.map((q) => isQuestionAnswered(q, answers[q.id]))
        : [];
    const answeredCount = answeredFlags.filter(Boolean).length;
    const unansweredCount = answeredFlags.length - answeredCount;
    const hasProgress = answeredCount > 0;

    useEffect(() => {
        // Only guard against losing real work — a fresh, untouched assessment should
        // not trip the browser's native unsaved-changes prompt.
        if (step !== "in-progress" || !hasProgress) return;
        function handler(e: BeforeUnloadEvent) {
            e.preventDefault();
        }
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [step, hasProgress]);

    if (step === "loading") {
        return (
            <div className="flex min-h-[60dvh] items-center justify-center text-sm text-muted-foreground">
                Preparing your assessment...
            </div>
        );
    }

    if (step === "blocked") {
        return (
            <AssessmentBlockedState
                variant={blockedVariant}
                message={blockedMessage}
                onRetry={
                    blockedVariant === "submit"
                        ? () => {
                              void handleSubmit();
                          }
                        : () => window.location.reload()
                }
                onBack={() => router.push(exitHref)}
                backLabel={exitLabel}
            />
        );
    }

    if (step === "submitting") {
        return (
            <div className="flex min-h-[60dvh] items-center justify-center text-sm text-muted-foreground">
                Submitting your answers...
            </div>
        );
    }

    if (!data) return null;

    const question = data.questions[currentIndex];
    const isLast = currentIndex === data.questions.length - 1;

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 py-4 sm:min-h-[calc(100dvh-3rem)] sm:justify-center sm:py-8">
            <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
                <QuestionCard
                    question={question}
                    index={currentIndex}
                    total={data.questions.length}
                    timeRemainingSeconds={secondsRemaining}
                    value={answers[question.id] || []}
                    onChange={(next) => setAnswers((prev) => ({ ...prev, [question.id]: next }))}
                    answeredFlags={answeredFlags}
                />
            </div>

            <div className="flex justify-between gap-2">
                <Button
                    variant="outline"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                >
                    Back
                </Button>
                {isLast ? (
                    <Button onClick={() => setConfirmSubmitOpen(true)}>Submit</Button>
                ) : (
                    <Button onClick={() => setCurrentIndex((i) => i + 1)}>Next</Button>
                )}
            </div>

            <LeaveConfirmDialog
                open={pendingNav !== null}
                onOpenChange={(open) => {
                    if (!open) clearPending();
                }}
                onConfirm={confirmLeave}
            />

            <SubmitConfirmDialog
                open={confirmSubmitOpen}
                onOpenChange={setConfirmSubmitOpen}
                unansweredCount={unansweredCount}
                onConfirm={() => {
                    setConfirmSubmitOpen(false);
                    handleSubmit();
                }}
            />
        </div>
    );
}
