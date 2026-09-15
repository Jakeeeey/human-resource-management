"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { APPLICANT_STATUS, APPLICANT_STATUS_LABELS, ApplicantStatusSchema } from "../types";
import { useApplicantFilterContext } from "../providers/filterProvider";

export function Toolbar() {
    const { filters, updateSearch, updateStatus, resetFilters } =
        useApplicantFilterContext();

    const hasActiveFilters = filters.search !== "" || filters.status !== null;

    return (
        <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 min-w-0">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search applicant name..."
                            value={filters.search}
                            onChange={(e) => updateSearch(e.target.value)}
                            className="pl-8 applicants-search"
                        />
                    </div>
                </div>

                <Select
                    value={filters.status ?? "all"}
                    onValueChange={(val) => {
                        // Boundary parse: only canonical ApplicantStatus values
                        // filter — "all" and any malformed value clear the filter.
                        const parsed = ApplicantStatusSchema.safeParse(val);
                        updateStatus(parsed.success ? parsed.data : null);
                    }}
                >
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        {APPLICANT_STATUS.map((status) => (
                            <SelectItem key={status} value={status}>
                                {APPLICANT_STATUS_LABELS[status]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Button
                    variant="ghost"
                    onClick={resetFilters}
                    disabled={!hasActiveFilters}
                    className="h-10 px-3 w-full sm:w-auto"
                >
                    Reset
                    <X className="ml-2 h-4 w-4" />
                </Button>
        </div>
    );
}
