"use client";

import { useIndustryFilterContext } from "../providers/IndustryFilterProvider";

export function useIndustryFilters() {
    return useIndustryFilterContext();
}
