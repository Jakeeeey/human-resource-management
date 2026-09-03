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
import { useTemplateFilterContext } from "../providers/filterProvider";
import type { Stage, TemplateStatus } from "../types";

const STAGE_LABELS: Record<Stage, string> = {
    Initial: "Initial",
    Final: "Final",
};

const STATUS_LABELS: Record<TemplateStatus, string> = {
    draft: "Draft",
    active: "Active",
    archived: "Archived",
};

export function Toolbar() {
    const { filters, updateSearch, updateStage, updateStatus, resetFilters } =
        useTemplateFilterContext();

    const hasActiveFilters =
        filters.search || filters.stage != null || filters.status != null;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search templates..."
                            value={filters.search}
                            onChange={(e) => updateSearch(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                </div>

                <Select
                    value={filters.stage ?? "all"}
                    onValueChange={(val) =>
                        updateStage(val === "all" ? null : (val as Stage))
                    }
                >
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="All stages" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All stages</SelectItem>
                        {Object.entries(STAGE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    value={filters.status ?? "all"}
                    onValueChange={(val) =>
                        updateStatus(val === "all" ? null : (val as TemplateStatus))
                    }
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
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
                    {filters.stage != null && (
                        <Badge variant="secondary">
                            Stage: {STAGE_LABELS[filters.stage]}
                            <button
                                onClick={() => updateStage(null)}
                                className="ml-1 rounded-full hover:bg-secondary-foreground/20"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    )}
                    {filters.status != null && (
                        <Badge variant="secondary">
                            Status: {STATUS_LABELS[filters.status]}
                            <button
                                onClick={() => updateStatus(null)}
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
