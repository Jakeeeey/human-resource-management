"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDivisionFilters } from "@/modules/human-resource-management/employee-admin/structrure/division";
import { SingleDatePicker } from "./SingleDatePicker";

export function DivisionToolbar() {
    const {
        filters,
        updateSearch,
        updateDateRange,
        resetFilters,
    } = useDivisionFilters();

    return (
        <div className="flex gap-2">
            <Input
                placeholder="Search..."
                value={filters.search}
                onChange={(e) => updateSearch(e.target.value)}
            />

            <SingleDatePicker
                placeholder="From"
                value={filters.dateRange.from}
                onChange={(date: Date | null) =>
                    updateDateRange(date, filters.dateRange.to)
                }
            />

            <SingleDatePicker
                placeholder="To"
                value={filters.dateRange.to}
                onChange={(date: Date | null) =>
                    updateDateRange(filters.dateRange.from, date)
                }
            />

            <Button onClick={resetFilters}>
                Reset
            </Button>
        </div>
    );
}
