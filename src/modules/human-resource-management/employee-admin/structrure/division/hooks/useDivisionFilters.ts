/**
 * useDivisionFilters Hook
 * Wrapper for filter context
 */

"use client";

import { useDivisionFilterContext } from "../providers/DivisionFilterProvider";

export function useDivisionFilters() {
    return useDivisionFilterContext();
}