"use client";

import React from "react";
import type { TakingQuestion } from "../types";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import Image from "next/image";

interface QuestionCardProps {
    question: TakingQuestion;
    index: number;
    total: number;
    timeRemainingSeconds: number | null;
    value: string[];
    onChange: (answers: string[]) => void;
}

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
}: QuestionCardProps) {
    const isChoiceType =
        question.question_type === "true_false" || question.question_type === "multiple_choice";
    const isFillInTheBlank = question.question_type === "fill_in_the_blank";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                    {Array.from({ length: total }, (_, i) => (
                        <span
                            key={i}
                            className={`h-2 w-2 rounded-full ${
                                i <= index ? "bg-primary" : "bg-muted"
                            }`}
                        />
                    ))}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                    <span className="text-sm text-muted-foreground">
                        Question {index + 1} of {total}
                    </span>
                    {timeRemainingSeconds != null && (
                        <span className="text-sm font-medium tabular-nums">
                            {formatTime(timeRemainingSeconds)}
                        </span>
                    )}
                </div>
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
                            return (
                                <div
                                    key={choice.id}
                                    onClick={() => onChange([String(choice.id)])}
                                    className="flex cursor-pointer items-center gap-3 rounded-md border p-3"
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
