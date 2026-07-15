"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ManufacturingLine, LineFormValues } from "../types";
import { LineRegistrationService } from "../services/LineRegistrationService";

interface LineRegistrationFetchContextType {
    lines: ManufacturingLine[];
    isLoading: boolean;
    refetch: () => Promise<void>;
    addLine: (data: LineFormValues) => Promise<boolean>;
    updateLine: (id: number, data: Partial<LineFormValues>) => Promise<boolean>;
    removeLine: (id: number) => Promise<boolean>;
}

const LineRegistrationFetchContext =
    createContext<LineRegistrationFetchContextType | undefined>(undefined);

export function LineRegistrationFetchProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [lines, setLines] = useState<ManufacturingLine[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await LineRegistrationService.getLines();
            setLines(data);
        } catch (err) {
            console.error("Failed to fetch manufacturing lines", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const addLine = async (data: LineFormValues) => {
        const created = await LineRegistrationService.createLine(data);
        if (created) {
            await fetchData();
            return true;
        }
        return false;
    };

    const updateLine = async (id: number, data: Partial<LineFormValues>) => {
        const success = await LineRegistrationService.updateLine(id, data);
        if (success) {
            await fetchData();
        }
        return success;
    };

    const removeLine = async (id: number) => {
        const success = await LineRegistrationService.deleteLine(id);
        if (success) {
            await fetchData();
            return true;
        }
        return false;
    };

    return React.createElement(
        LineRegistrationFetchContext.Provider,
        {
            value: {
                lines,
                isLoading,
                refetch: fetchData,
                addLine,
                updateLine,
                removeLine,
            },
        },
        children
    );
}

export function useLineRegistrationFetchContext() {
    const ctx = useContext(LineRegistrationFetchContext);
    if (!ctx)
        throw new Error(
            "Must be used inside LineRegistrationFetchProvider"
        );
    return ctx;
}
