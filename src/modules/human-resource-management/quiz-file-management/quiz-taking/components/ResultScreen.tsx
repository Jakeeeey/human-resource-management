"use client";

import React, { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnswerKeyDialog } from "@/modules/human-resource-management/quiz-file-management/quiz-history/components/AnswerKeyDialog";
import type { QuizAttempt } from "@/modules/human-resource-management/quiz-file-management/quiz-history/types";

function formatPercentage(value: number | string): string {
    return `${parseFloat(String(value))}%`;
}

interface ResultScreenProps {
    attempt: QuizAttempt;
    onNextCandidate: () => void;
}

export function ResultScreen({ attempt, onNextCandidate }: ResultScreenProps) {
    const [answerKeyOpen, setAnswerKeyOpen] = useState(false);

    return (
        <div className="mx-auto max-w-md space-y-6 py-8">
            <div className="flex flex-col items-center gap-2 text-center">
                {attempt.passed ? (
                    <CheckCircle2 className="h-12 w-12 text-green-600" />
                ) : (
                    <XCircle className="h-12 w-12 text-destructive" />
                )}
                <Badge variant={attempt.passed ? "secondary" : "destructive"} className="text-base px-4 py-1">
                    {attempt.passed ? "PASSED" : "FAILED"}
                </Badge>
            </div>

            <div className="rounded-lg border p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Applicant</span>
                    <span className="font-medium">{attempt.applicant?.full_name || "—"}</span>
                </div>
                {attempt.applicant?.position_applied_for && (
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Position</span>
                        <span className="font-medium">{attempt.applicant.position_applied_for}</span>
                    </div>
                )}
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Quiz</span>
                    <span className="font-medium">{attempt.quiz?.name || "—"}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Score</span>
                    <span className="font-medium">
                        {attempt.score} / {attempt.number_of_questions_snapshot} (
                        {formatPercentage(attempt.percentage_score)})
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Passing</span>
                    <span className="font-medium">{formatPercentage(attempt.pass_threshold_value_snapshot)}</span>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <Button variant="outline" onClick={() => setAnswerKeyOpen(true)}>
                    View Answer Breakdown
                </Button>
                <Button onClick={onNextCandidate}>Next Candidate</Button>
            </div>

            <AnswerKeyDialog open={answerKeyOpen} onOpenChange={setAnswerKeyOpen} attemptId={attempt.id} />
        </div>
    );
}
