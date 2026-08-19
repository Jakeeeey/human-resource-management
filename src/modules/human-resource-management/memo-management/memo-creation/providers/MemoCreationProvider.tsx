"use client";

import React, { createContext, useCallback, useEffect, useState } from "react";
import { Memo } from "../types";

interface MemoCreationContextValue {
    memos: Memo[];
    isLoading: boolean;
    isCreateOpen: boolean;
    setIsCreateOpen: (val: boolean) => void;
    editingMemo: Memo | null;
    setEditingMemo: (memo: Memo | null) => void;
    refresh: () => Promise<void>;
}

export const MemoCreationContext = createContext<MemoCreationContextValue | undefined>(undefined);

export function MemoCreationProvider({ children }: { children: React.ReactNode }) {
    const [memos, setMemos] = useState<Memo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingMemo, setEditingMemo] = useState<Memo | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/hrm/memo-management/memo-creation");
            if (res.ok) {
                const data = await res.json();
                setMemos(data.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch memos", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return (
        <MemoCreationContext.Provider
            value={{
                memos,
                isLoading,
                isCreateOpen,
                setIsCreateOpen,
                editingMemo,
                setEditingMemo,
                refresh,
            }}
        >
            {children}
        </MemoCreationContext.Provider>
    );
}
