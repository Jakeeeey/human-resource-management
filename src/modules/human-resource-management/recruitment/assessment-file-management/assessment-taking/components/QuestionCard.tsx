"use client";

import React from "react";
import type { TakingQuestion } from "../types";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface QuestionCardProps {
    question: TakingQuestion;
    index: number;
    total: number;
    timeRemainingSeconds: number | null;
    value: string[];
    onChange: (answers: string[]) => void;
    /** Per-question answered flags, indexed by question position. */
    answeredFlags: boolean[];
}

/** At or below this many questions we render the compact dot trail; above it a bar. */
const MAX_DOTS = 8;

function formatTime(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export function QuestionCard({
    question,
    index,
    total,
    timeRemainingSeconds,
    value,
    onChange,
    answeredFlags,
}: QuestionCardProps) {
    const isChoiceType =
        question.question_type === "true_false" || question.question_type === "multiple_choice";
    const isFillInTheBlank = question.question_type === "fill_in_the_blank";

    const answeredCount = answeredFlags.filter(Boolean).length;
    const timerState =
        timeRemainingSeconds == null
            ? "normal"
            : timeRemainingSeconds <= 30
              ? "critical"
              : timeRemainingSeconds <= 120
                ? "warning"
                : "normal";

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                    {total <= MAX_DOTS ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                            {answeredFlags.map((isAnswered, i) => (
                                <span
                                    key={i}
                                    title={`Question ${i + 1}: ${
                                        isAnswered ? "answered" : "not answered"
                                    }`}
                                    aria-label={`Question ${i + 1} ${
                                        isAnswered ? "answered" : "not answered"
                                    }`}
                                    className={cn(
                                        "h-2 w-2 rounded-full transition-colors",
                                        i === index
                                            ? "bg-primary ring-2 ring-primary/40 ring-offset-1 ring-offset-background"
                                            : isAnswered
                                              ? "bg-primary/60"
                                              : "bg-muted"
                                    )}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="h-2 w-40 max-w-[40%] overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{
                                    width: `${total ? (answeredCount / total) * 100 : 0}%`,
                                }}
                            />
                        </div>
                    )}
                    <div className="flex items-center gap-4 shrink-0">
                        <span className="text-sm text-muted-foreground">
                            Question {index + 1} of {total}
                        </span>
                        {timeRemainingSeconds != null && (
                            <span className="flex items-center gap-1.5 text-sm">
                                <span className="text-muted-foreground">Time left</span>
                                <span
                                    className={cn(
                                        "font-medium tabular-nums",
                                        timerState === "critical" && "text-destructive",
                                        timerState === "warning" && "text-amber-600 dark:text-amber-500"
                                    )}
                                >
                                    {formatTime(timeRemainingSeconds)}
                                </span>
                            </span>
                        )}
                    </div>
                </div>
                <p className="text-xs text-muted-foreground">
                    {answeredCount} of {total} answered
                </p>
            </div>

            <div className="space-y-4">
                <p className="text-lg font-medium">{question.question_text}</p>

                {question.question_image && (
                    <Image
                        src={`${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/assets/${question.question_image}`}
                        alt="Question"
                        width={240}
                        height={240}
                        className="h-[240px] w-[240px] rounded-lg object-contain border bg-white dark:bg-slate-950"
                        unoptimized
                    />
                )}

                {isChoiceType && (
                    <RadioGroup
                        value={value[0] ?? ""}
                        onValueChange={(v) => onChange([v])}
                        className="space-y-2"
                    >
                        {question.choices.map((choice, i) => {
                            const letter =
                                question.question_type === "multiple_choice"
                                    ? `${String.fromCharCode(65 + i)}.`
                                    : null;
                            const selected = value[0] === String(choice.id);
                            return (
                                <div
                                    key={choice.id}
                                    onClick={() => onChange([String(choice.id)])}
                                    className={cn(
                                        "flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors",
                                        selected
                                            ? "border-primary bg-accent"
                                            : "hover:bg-accent/50"
                                    )}
                                >
                                    <RadioGroupItem
                                        value={String(choice.id)}
                                        id={`choice-${choice.id}`}
                                    />
                                    <Label
                                        htmlFor={`choice-${choice.id}`}
                                        className="flex flex-1 cursor-pointer items-center gap-3 font-normal"
                                    >
                                        {letter && (
                                            <span className="font-medium text-muted-foreground">
                                                {letter}
                                            </span>
                                        )}
                                        {choice.option_image && (
                                            <Image
                                                src={`${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/assets/${choice.option_image}`}
                                                alt={choice.option_text || `Option ${letter ?? i + 1}`}
                                                width={96}
                                                height={96}
                                                className="h-24 w-24 rounded border object-contain bg-white dark:bg-slate-950"
                                                unoptimized
                                            />
                                        )}
                                        {choice.option_text && <span>{choice.option_text}</span>}
                                    </Label>
                                </div>
                            );
                        })}
                    </RadioGroup>
                )}

                {question.question_type === "identification" && (
                    <Input
                        placeholder="Your answer"
                        value={value[0] ?? ""}
                        onChange={(e) => onChange([e.target.value])}
                        autoFocus
                    />
                )}

                {isFillInTheBlank && (
                    <div className="space-y-3">
                        {Array.from({ length: question.blank_count }, (_, blankIndex) => (
                            <div key={blankIndex} className="space-y-1.5">
                                <Label>Blank {blankIndex + 1}</Label>
                                <Input
                                    placeholder="Your answer"
                                    value={value[blankIndex] ?? ""}
                                    onChange={(e) => {
                                        const next = [...value];
                                        next[blankIndex] = e.target.value;
                                        onChange(next);
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
