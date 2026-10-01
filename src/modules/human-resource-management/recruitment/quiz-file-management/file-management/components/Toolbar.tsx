"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { useFileManagementFilterContext } from "../providers/filterProvider";
import { useFileManagementFetchContext } from "../providers/fetchProvider";
import type { QuestionType } from "../types";

const TYPE_LABELS: Record<QuestionType, string> = {
    true_false: "True / False",
    multiple_choice: "Multiple Choice",
    identification: "Identification",
    fill_in_the_blank: "Fill in the Blank",
};

export function Toolbar() {
    const { filters, updateSearch, updateQuestionType, updateCategory, updateIncludeInactive, resetFilters } =
        useFileManagementFilterContext();
    const { allQuestions } = useFileManagementFetchContext();

    const hasActiveFilters =
        filters.search || filters.questionType != null || filters.category != null || filters.includeInactive;

    const categoryOptions = React.useMemo(() => {
        const set = new Set<string>();
        allQuestions.forEach((q) => {
            if (q.category) set.add(q.category);
        });
        return Array.from(set).sort();
    }, [allQuestions]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search questions..."
                            value={filters.search}
                            onChange={(e) => updateSearch(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                </div>

                <Select
                    value={filters.questionType ?? "all"}
                    onValueChange={(val) =>
                        updateQuestionType(val === "all" ? null : (val as QuestionType))
                    }
                >
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        {Object.entries(TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    value={filters.category ?? "all"}
                    onValueChange={(val) => updateCategory(val === "all" ? null : val)}
                    disabled={categoryOptions.length === 0}
                >
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {categoryOptions.map((category) => (
                            <SelectItem key={category} value={category}>
                                {category}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="flex items-center gap-2 h-10 px-3 rounded-md border">
                    <Switch
                        id="include-inactive"
                        checked={filters.includeInactive}
                        onCheckedChange={updateIncludeInactive}
                    />
                    <Label htmlFor="include-inactive" className="text-sm font-normal cursor-pointer">
                        Show inactive
                    </Label>
                </div>

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
                    {filters.questionType != null && (
                        <Badge variant="secondary">
                            Type: {TYPE_LABELS[filters.questionType]}
                            <button
                                onClick={() => updateQuestionType(null)}
                                className="ml-1 rounded-full hover:bg-secondary-foreground/20"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    )}
                    {filters.category != null && (
                        <Badge variant="secondary">
                            Category: {filters.category}
                            <button
                                onClick={() => updateCategory(null)}
                                className="ml-1 rounded-full hover:bg-secondary-foreground/20"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    )}
                    {filters.includeInactive && (
                        <Badge variant="secondary">
                            Showing inactive
                            <button
                                onClick={() => updateIncludeInactive(false)}
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
