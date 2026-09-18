"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { QuizAttemptDetail } from "../types";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { QuestionGroupCard } from "./AnswerKeyBodies";
import { formatDateTime, formatPercentage, groupByQuestion } from "./answerKeyUtils";

interface AnswerKeyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    attemptId: number | null;
}

export function AnswerKeyDialog({ open, onOpenChange, attemptId }: AnswerKeyDialogProps) {
    const [detail, setDetail] = useState<QuizAttemptDetail | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!open || !attemptId) return;

        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsLoading(true);
        fetch(`/api/hrm/quiz-file-management/quiz-attempt/${attemptId}`)
            .then((res) => res.json())
            .then((data) => {
                if (!cancelled) setDetail(data);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
            setDetail(null);
        };
    }, [open, attemptId]);

    const attempt = detail?.attempt;
    const groups = useMemo(
        () => (detail?.answers ? groupByQuestion(detail.answers) : []),
        [detail]
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Answer Breakdown</DialogTitle>
                    <DialogDescription>
                        Exactly what was asked and answered in this attempt. Each option shows
                        whether it was correct and which option the applicant chose.
                    </DialogDescription>
                </DialogHeader>

                {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

                {!isLoading && attempt && (
                    <div className="space-y-4">
                        <div className="rounded-lg border p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            <div>
                                <span className="text-muted-foreground">Applicant: </span>
                                <span className="font-medium">{attempt.applicant?.full_name || "—"}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Quiz: </span>
                                <span className="font-medium">{attempt.quiz?.name || "—"}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Score: </span>
                                <span className="font-medium">
                                    {attempt.score} / {attempt.number_of_questions_snapshot} (
                                    {formatPercentage(attempt.percentage_score)})
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Result: </span>
                                <Badge variant={attempt.passed ? "secondary" : "destructive"}>
                                    {attempt.passed ? "Passed" : "Failed"}
                                </Badge>
                            </div>
                            <div className="sm:col-span-2">
                                <span className="text-muted-foreground">Completed: </span>
                                <span className="font-medium">{formatDateTime(attempt.completed_at)}</span>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-3">
                            {groups.map((group, index) => (
                                <QuestionGroupCard key={group.questionId} group={group} index={index} />
                            ))}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
