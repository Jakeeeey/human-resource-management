/**
 * useDepartmentScheduleFilters Hook
 * Wrapper for filter context
 */

"use client";

import { useDepartmentScheduleFilterContext } from "../providers/DepartmentScheduleFilterProvider";

export function useDepartmentScheduleFilters() {
    const ctx = useDepartmentScheduleFilterContext();

    return {
        filters: ctx.filters,
        updateSearch: ctx.updateSearch,
        updateFromDate: ctx.updateFromDate,
        updateToDate: ctx.updateToDate,
        resetFilters: ctx.resetFilters,
    };

    return useDepartmentScheduleFilterContext();


}