"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import type { Division } from "../types";
import { useDepartmentFilters } from "../hooks/userDepartmentFilters";
import { SingleDatePicker } from "@/modules/human-resource-management/employee-admin/structrure/department/components/SingleDatePicker";

// ============================================================================
// COMPONENT
// ============================================================================

interface DepartmentToolbarProps {
    divisions: Division[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function DepartmentToolbar({ divisions }: DepartmentToolbarProps) {
    const {
        filters,
        updateSearch,
        updateFromDate,
        updateToDate,
        resetFilters,
    } = useDepartmentFilters();



    const hasActiveFilters =
        filters.search ||
        filters.dateRange.from ||
        filters.dateRange.to;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">

                {/* ================= SEARCH ================= */}

                <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search departments..."
                            value={filters.search}
                            onChange={(e) => updateSearch(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                </div>


                {/* ================= DATE FILTERS ================= */}

                <SingleDatePicker
                    placeholder="From date"
                    value={filters.dateRange.from}
                    onChange={(d) => updateFromDate(d ?? null)}
                />

                <SingleDatePicker
                    placeholder="To date"
                    value={filters.dateRange.to}
                    onChange={(d) => updateToDate(d ?? null)}
                />

                {/* ================= RESET ================= */}

                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        onClick={resetFilters}
                        className="h-10 px-3"
                    >
                        Reset
                        <X className="ml-2 h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* ================= ACTIVE BADGES ================= */}

            {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                        Active filters:
                    </span>

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


                    {filters.dateRange.from && (
                        <Badge variant="secondary">
                            From set
                            <button
                                onClick={() => updateFromDate(null)}
                                className="ml-1 rounded-full hover:bg-secondary-foreground/20"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    )}

                    {filters.dateRange.to && (
                        <Badge variant="secondary">
                            To set
                            <button
                                onClick={() => updateToDate(null)}
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
