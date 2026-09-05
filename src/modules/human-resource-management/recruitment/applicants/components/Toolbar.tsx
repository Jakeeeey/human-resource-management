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
import { APPLICANT_STAGE } from "../lib/deriveApplicantStage";
import { useApplicantFilterContext } from "../providers/filterProvider";

export function Toolbar() {
    const { filters, updateSearch, updateStage, resetFilters } =
        useApplicantFilterContext();

    const hasActiveFilters = filters.search !== "" || filters.stage !== null;

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
                    value={filters.stage ?? "all"}
                    onValueChange={(val) =>
                        updateStage(val === "all" ? null : (val as (typeof APPLICANT_STAGE)[number]))
                    }
                >
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="All stages" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All stages</SelectItem>
                        {APPLICANT_STAGE.map((stage) => (
                            <SelectItem key={stage} value={stage}>
                                {stage}
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
