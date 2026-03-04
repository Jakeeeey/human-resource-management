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
import { useEmployeeFileRecordListFilterContext } from "../providers/filterProvider";
import { SingleDatePicker } from "@/modules/human-resource-management/employee-admin/structrure/department/components/SingleDatePicker";
import type { EmployeeFileRecordType } from "../../employee-file-record-type/types";

interface EmployeeFileRecordListToolbarProps {
    recordTypes: EmployeeFileRecordType[];
}

export function EmployeeFileRecordListToolbar({
    recordTypes,
}: EmployeeFileRecordListToolbarProps) {
    const {
        filters,
        updateSearch,
        updateRecordTypeId,
        updateFromDate,
        updateToDate,
        resetFilters,
    } = useEmployeeFileRecordListFilterContext();

    const hasActiveFilters =
        filters.search ||
        filters.recordTypeId != null ||
        filters.dateRange.from ||
        filters.dateRange.to;

    const selectedTypeName =
        filters.recordTypeId != null
            ? recordTypes.find((t) => t.id === filters.recordTypeId)?.name
            : undefined;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search records..."
                            value={filters.search}
                            onChange={(e) => updateSearch(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                </div>

                <Select
                    value={
                        filters.recordTypeId != null
                            ? filters.recordTypeId.toString()
                            : "all"
                    }
                    onValueChange={(val) =>
                        updateRecordTypeId(val === "all" ? null : Number(val))
                    }
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        {recordTypes.map((t) => (
                            <SelectItem key={t.id} value={t.id.toString()}>
                                {t.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

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
                    {filters.recordTypeId != null && (
                        <Badge variant="secondary">
                            Type: {selectedTypeName}
                            <button
                                onClick={() => updateRecordTypeId(null)}
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
