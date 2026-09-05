"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { useQuizHistoryFilterContext } from "../providers/filterProvider";
import type { QuizAttempt } from "../types";

interface ToolbarProps {
    attempts: QuizAttempt[];
}

export function Toolbar({ attempts }: ToolbarProps) {
    const { filters, updateSearch, updateQuizId, updatePassed, resetFilters } =
        useQuizHistoryFilterContext();

    const hasActiveFilters =
        filters.search || filters.quizId != null || filters.passed != null;

    const quizOptions = React.useMemo(() => {
        const map = new Map<number, string>();
        attempts.forEach((a) => {
            if (a.quiz) map.set(a.quiz.id, a.quiz.name);
        });
        return Array.from(map.entries());
    }, [attempts]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search applicant name..."
                            value={filters.search}
                            onChange={(e) => updateSearch(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                </div>

                <Select
                    value={filters.quizId != null ? String(filters.quizId) : "all"}
                    onValueChange={(val) => updateQuizId(val === "all" ? null : Number(val))}
                >
                    <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="All quizzes" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All quizzes</SelectItem>
                        {quizOptions.map(([id, name]) => (
                            <SelectItem key={id} value={String(id)}>
                                {name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    value={filters.passed === null ? "all" : filters.passed ? "passed" : "failed"}
                    onValueChange={(val) =>
                        updatePassed(val === "all" ? null : val === "passed")
                    }
                >
                    <SelectTrigger className="w-full sm:w-[160px]">
                        <SelectValue placeholder="All results" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All results</SelectItem>
                        <SelectItem value="passed">Passed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                </Select>

                {hasActiveFilters && (
                    <Button variant="ghost" onClick={resetFilters} className="h-10 px-3">
                        Reset
                        <X className="ml-2 h-4 w-4" />
                    </Button>
                )}
            </div>

            {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">Active filters:</span>
                    {filters.search && (
                        <Badge variant="secondary">
                            Search: {filters.search}
                            <button
                                onClick={() => updateSearch("")}
                                className="ml-1 rounded-full hover:bg-secondary-foreground/20"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    )}
                    {filters.passed != null && (
                        <Badge variant="secondary">
                            Result: {filters.passed ? "Passed" : "Failed"}
                            <button
                                onClick={() => updatePassed(null)}
                                className="ml-1 rounded-full hover:bg-secondary-foreground/20"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    )}
                </div>
            )}
        </div>
    );
}
