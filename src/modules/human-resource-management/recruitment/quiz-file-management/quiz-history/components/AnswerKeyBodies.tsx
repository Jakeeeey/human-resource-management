"use client";

import React from "react";
import type { QuizAttemptAnswer } from "../types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";
import Image from "next/image";
import {
    CHOICE_TYPES,
    QUESTION_TYPE_LABELS,
    letterFor,
    norm,
    parseSnapshot,
    rowHasAnswer,
    type QuestionGroup,
} from "./answerKeyUtils";

function CorrectnessIcon({ correct }: { correct: boolean }) {
    return correct ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
    ) : (
        <XCircle className="h-4 w-4 shrink-0 text-destructive" />
    );
}

function NoAnswerBadge() {
    return (
        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
            No answer
        </Badge>
    );
}

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

function ChoiceBody({ row }: { row: QuizAttemptAnswer }) {
    const snap = parseSnapshot(row.answer_key_snapshot);
    if (!snap || snap.kind !== "choice" || snap.options.length === 0) {
        return <FallbackAnswer row={row} />;
    }

    const showLetters = row.question_type === "multiple_choice";
    const isById = snap.options.some((o) => o.id != null);
    const givenChoiceId = isById
        ? snap.given_choice_id ?? row.answer_given_choice_id ?? null
        : null;
    const givenText = row.answer_given_text;

    const chosenMatched = isById
        ? snap.options.some((o) => o.id === givenChoiceId)
        : norm(givenText) !== "" && snap.options.some((o) => norm(o.text) === norm(givenText));

    const hasGiven = isById ? givenChoiceId != null : norm(givenText) !== "";

    const assetBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";

    return (
        <div className="space-y-1.5">
            {snap.options.map((opt, i) => {
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
            {!hasGiven && <NoAnswerBadge />}
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
    const hasGiven = (given ?? "").trim() !== "";
    return (
        <div className="space-y-0.5 text-sm">
            <div className="flex items-center gap-2">
                {label && (
                    <span className="text-xs font-medium text-muted-foreground">{label}</span>
                )}
                {hasGiven ? (
                    <span>
                        Given: <span className="font-medium">{given}</span>
                    </span>
                ) : (
                    <NoAnswerBadge />
                )}
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
                        {(row.answer_given_text ?? "").trim() !== "" ? (
                            <span>
                                Given:{" "}
                                <span className="font-medium">{row.answer_given_text}</span>
                            </span>
                        ) : (
                            <NoAnswerBadge />
                        )}
                        <CorrectnessIcon correct={row.is_correct} />
                    </div>
                )
            )}
        </div>
    );
}

export function QuestionGroupCard({ group, index }: { group: QuestionGroup; index: number }) {
    const allCorrect = group.rows.every((r) => r.is_correct);
    const anyAnswer = group.rows.some((r) => rowHasAnswer(r));
    return (
        <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium">
                    {index + 1}. {group.questionText}
                </div>
                <CorrectnessIcon correct={allCorrect} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-xs">
                    {QUESTION_TYPE_LABELS[group.questionType] || group.questionType}
                </Badge>
                {!anyAnswer && <NoAnswerBadge />}
            </div>
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
