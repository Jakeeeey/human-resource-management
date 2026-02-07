/**
 * useDepartmentFilters Hook
 * Convenience hook for accessing global filter state
 */

"use client";

import { useDepartmentFilterContext } from "../providers/DepartmentFilterProvider";

export function useDepartmentFilters() {
    return useDepartmentFilterContext();
}