import { useState, useCallback } from "react";
import { LogisticsTopSheetItem } from "../types/logistics-top-sheet.schema";
import { fetchLogisticsTopSheet } from "../services/logistics-top-sheet";

export const useLogisticsTopSheet = () => {
    const [data, setData] = useState<LogisticsTopSheetItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async (start: string, end: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetchLogisticsTopSheet(start, end);
            setData(res.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load top sheet data");
            setData([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        data,
        isLoading,
        error,
        loadData
    };
};
