"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { AnswerKeySnapshot, QuizAttemptAnswer, QuizAttemptDetail } from "../types";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";
import Image from "next/image";

function letterFor(index: number): string {
    return String.fromCharCode(65 + index);
}

interface AnswerKeyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    attemptId: number | null;
}

const TYPE_LABELS: Record<string, string> = {
    true_false: "True / False",
    multiple_choice: "Multiple Choice",
    identification: "Identification",
    fill_in_the_blank: "Fill in the Blank",
};

const CHOICE_TYPES = new Set(["true_false", "multiple_choice"]);

function norm(value: string | null | undefined): string {
    return (value ?? "").trim().toLowerCase();
}

function formatPercentage(value: number | string): string {
    return `${parseFloat(String(value))}%`;
}

function formatDateTime(value: string | null): string {
    if (!value) return "—";
    try {
        return new Date(value).toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    } catch {
        return value;
    }
}

// A real MySQL JSON column comes back from Directus either already parsed or as
// a raw string depending on field config -- accept both, fail soft to null.
function parseSnapshot(
    raw: AnswerKeySnapshot | string | null
): AnswerKeySnapshot | null {
    if (!raw) return null;
    if (typeof raw === "string") {
        try {
            return JSON.parse(raw) as AnswerKeySnapshot;
        } catch {
            return null;
        }
    }
    return raw;
}

interface QuestionGroup {
    questionId: number;
    questionText: string;
    questionType: string;
    rows: QuizAttemptAnswer[];
}

// Fill-in-the-blank stores one row per blank -- collapse every row for a
// question into a single card, keeping first-seen question order.
function groupByQuestion(answers: QuizAttemptAnswer[]): QuestionGroup[] {
    const order: number[] = [];
    const byId = new Map<number, QuestionGroup>();
    for (const row of answers) {
        let group = byId.get(row.question_id);
        if (!group) {
            group = {
                questionId: row.question_id,
                questionText: row.question_text_snapshot,
                questionType: row.question_type,
                rows: [],
            };
            byId.set(row.question_id, group);
            order.push(row.question_id);
        }
        group.rows.push(row);
    }
    return order.map((id) => byId.get(id)!);
}

function CorrectnessIcon({ correct }: { correct: boolean }) {
    return correct ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
    ) : (
        <XCircle className="h-4 w-4 shrink-0 text-destructive" />
    );
}

// Plain line for rows with no usable snapshot: attempts graded before the
// answer_key_snapshot column existed, or a question that has left the pool.
function FallbackAnswer({ row }: { row: QuizAttemptAnswer }) {
    return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
                Answered: <span className="font-medium">{row.answer_given_text || "—"}</span>
            </span>
            <CorrectnessIcon correct={row.is_correct} />
        </div>
    );
}

// true_false / multiple_choice -- show every option (as a pill or a thumbnail),
// mark the correct one(s) and the one the applicant chose.
function ChoiceBody({ row }: { row: QuizAttemptAnswer }) {
    const snap = parseSnapshot(row.answer_key_snapshot);
    if (!snap || snap.kind !== "choice" || snap.options.length === 0) {
        return <FallbackAnswer row={row} />;
    }

    const showLetters = row.question_type === "multiple_choice";
    // Newer snapshots identify the pick by choice id; older ones only by text.
    const isById = snap.options.some((o) => o.id != null);
    const givenChoiceId = isById
        ? snap.given_choice_id ?? row.answer_given_choice_id ?? null
        : null;
    const givenText = row.answer_given_text;

    const chosenMatched = isById
        ? snap.options.some((o) => o.id === givenChoiceId)
        : norm(givenText) !== "" && snap.options.some((o) => norm(o.text) === norm(givenText));

    const assetBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";

    return (
        <div className="space-y-1.5">
            {snap.options.map((opt, i) => {
                // is_correct can arrive as a real boolean or a MySQL 0/1.
                const isCorrect = Boolean(opt.is_correct);
                const isGiven = isById
                    ? opt.id != null && opt.id === givenChoiceId
                    : norm(opt.text) !== "" && norm(opt.text) === norm(givenText);
                return (
                    <div key={opt.id ?? i} className="flex items-center gap-2 text-sm">
                        {showLetters && (
                            <span className="w-4 shrink-0 font-medium text-muted-foreground">
                                {letterFor(i)}
                            </span>
                        )}
                        {opt.image ? (
                            <Image
                                src={`${assetBase}/assets/${opt.image}`}
                                alt={opt.text || `Option ${letterFor(i)}`}
                                width={64}
                                height={64}
                                unoptimized
                                className={cn(
                                    "h-16 w-16 rounded border object-contain bg-white dark:bg-slate-950",
                                    isCorrect && "ring-2 ring-green-600",
                                    isGiven && !isCorrect && "ring-2 ring-destructive"
                                )}
                            />
                        ) : (
                            <Badge
                                variant="outline"
                                className={cn(
                                    "font-normal",
                                    isCorrect && "border-green-600 text-green-700",
                                    isGiven && !isCorrect && "border-destructive text-destructive"
                                )}
                            >
                                {opt.text || "—"}
                            </Badge>
                        )}
                        {isCorrect ? (
                            <span className="text-xs text-green-600">&#10003; correct</span>
                        ) : null}
                        {isGiven ? (
                            <span
                                className={cn(
                                    "text-xs",
                                    isCorrect ? "text-green-600" : "text-destructive"
                                )}
                            >
                                &middot; chosen
                            </span>
                        ) : null}
                    </div>
                );
            })}
            {isById && givenChoiceId != null && !chosenMatched && (
                <div className="text-xs text-destructive">
                    The chosen option is no longer among the choices.
                </div>
            )}
            {!isById && norm(givenText) !== "" && !chosenMatched && (
                <div className="text-xs text-destructive">
                    Chosen: <span className="font-medium">{givenText}</span> (not among the options)
                </div>
            )}
        </div>
    );
}

// One "Given / Accepted" pair -- used for identification and for each blank of
// a fill-in-the-blank question.
function TextRow({
    label,
    given,
    correct,
    accepted,
}: {
    label?: string;
    given: string | null;
    correct: boolean;
    accepted: string[];
}) {
    return (
        <div className="space-y-0.5 text-sm">
            <div className="flex items-center gap-2">
                {label && (
                    <span className="text-xs font-medium text-muted-foreground">{label}</span>
                )}
                <span>
                    Given: <span className="font-medium">{given || "—"}</span>
                </span>
                <CorrectnessIcon correct={correct} />
            </div>
            <div className="text-xs text-muted-foreground">
                Accepted:{" "}
                <span className="font-medium">
                    {accepted.length ? accepted.join("  ·  ") : "(none on file)"}
                </span>
            </div>
        </div>
    );
}

function IdentificationBody({ row }: { row: QuizAttemptAnswer }) {
    const snap = parseSnapshot(row.answer_key_snapshot);
    if (!snap || snap.kind !== "text") {
        return <FallbackAnswer row={row} />;
    }
    return (
        <TextRow given={row.answer_given_text} correct={row.is_correct} accepted={snap.accepted} />
    );
}

function FillInTheBlankBody({ rows }: { rows: QuizAttemptAnswer[] }) {
    // Order by the snapshot's blank_index; fall back to stored order for a row
    // that has no snapshot.
    const ordered = rows
        .map((row, idx) => {
            const snap = parseSnapshot(row.answer_key_snapshot);
            const blankIndex = snap && snap.kind === "text" ? snap.blank_index : idx;
            return { row, snap, blankIndex };
        })
        .sort((a, b) => a.blankIndex - b.blankIndex);

    return (
        <div className="space-y-2">
            {ordered.map(({ row, snap, blankIndex }) =>
                snap && snap.kind === "text" ? (
                    <TextRow
                        key={row.id}
                        label={`Blank ${blankIndex + 1}`}
                        given={row.answer_given_text}
                        correct={row.is_correct}
                        accepted={snap.accepted}
                    />
                ) : (
                    <div key={row.id} className="flex items-center gap-2 text-sm">
                        <span className="text-xs font-medium text-muted-foreground">
                            Blank {blankIndex + 1}
                        </span>
                        <span>
                            Given: <span className="font-medium">{row.answer_given_text || "—"}</span>
                        </span>
                        <CorrectnessIcon correct={row.is_correct} />
                    </div>
                )
            )}
        </div>
    );
}

function QuestionGroupCard({ group, index }: { group: QuestionGroup; index: number }) {
    const allCorrect = group.rows.every((r) => r.is_correct);
    return (
        <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium">
                    {index + 1}. {group.questionText}
                </div>
                <CorrectnessIcon correct={allCorrect} />
            </div>
            <Badge variant="outline" className="text-xs">
                {TYPE_LABELS[group.questionType] || group.questionType}
            </Badge>
            <div className="pt-1">
                {CHOICE_TYPES.has(group.questionType) ? (
                    <ChoiceBody row={group.rows[0]} />
                ) : group.questionType === "fill_in_the_blank" ? (
                    <FillInTheBlankBody rows={group.rows} />
                ) : group.questionType === "identification" ? (
                    <IdentificationBody row={group.rows[0]} />
                ) : (
                    <div className="space-y-1">
                        {group.rows.map((r) => (
                            <FallbackAnswer key={r.id} row={r} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export function AnswerKeyDialog({ open, onOpenChange, attemptId }: AnswerKeyDialogProps) {
    const [detail, setDetail] = useState<QuizAttemptDetail | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!open || !attemptId) return;

        let cancelled = false;
        // Standard fetch-on-open: the spinner has to be raised before the
        // request goes out, so this sync setState in the effect body is fine.
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

        // Clear on close / attempt change so a reopen never flashes stale data.
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
            <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Answer Breakdown</DialogTitle>
                    <DialogDescription>
                        Exactly what was asked and answered in this attempt.
                    </DialogDescription>
                </DialogHeader>

                {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

                {!isLoading && attempt && (
                    <div className="space-y-4">
                        <div className="rounded-lg border p-4 grid grid-cols-2 gap-2 text-sm">
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
                            <div className="col-span-2">
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
