"use client";

import { useScheduleSummaryContext } from "../providers/fetchProvider";

export function useScheduleSummary() {
    const context = useScheduleSummaryContext();
    return context;
}
