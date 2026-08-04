import { LogisticsTopSheetResponse } from "../types/logistics-top-sheet.schema";

export const fetchLogisticsTopSheet = async (cutoffStart: string, cutoffEnd: string): Promise<LogisticsTopSheetResponse> => {
    const params = new URLSearchParams();
    params.set("cutoff_start", cutoffStart);
    params.set("cutoff_end", cutoffEnd);

    const res = await fetch(`/api/hrm/payroll/logistics-top-sheet?${params.toString()}`);
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch top sheet");
    }

    return res.json();
};
