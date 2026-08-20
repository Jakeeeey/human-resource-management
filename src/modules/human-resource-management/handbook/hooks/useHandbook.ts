"use client";

import { useState, useMemo } from "react";
import { useHandbookContext } from "../providers/HandbookProvider";
import { Handbook } from "../types";

export function useHandbook() {
    const { 
        handbooks, 
        isLoading, 
        error, 
        refresh, 
        submitHandbook, 
        updateHandbook, 
        deleteHandbook,
        isCreateOpen,
        setIsCreateOpen,
        isEditOpen,
        setIsEditOpen,
        isDetailOpen,
        setIsDetailOpen,
        selectedHandbook,
        setSelectedHandbook
    } = useHandbookContext();

    const [searchQuery, setSearchQuery] = useState("");

    const filteredHandbooks = useMemo(() => {
        let result = handbooks;

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(
                (h) =>
                    h.title.toLowerCase().includes(query) ||
                    (h.description && h.description.toLowerCase().includes(query))
            );
        }

        return result;
    }, [handbooks, searchQuery]);

    const handleView = (handbook: Handbook) => {
        setSelectedHandbook(handbook);
        setIsDetailOpen(true);
    };

    return {
        handbooks: filteredHandbooks,
        allHandbooks: handbooks,
        isLoading,
        error,
        refresh,
        isCreateOpen,
        setIsCreateOpen,
        isEditOpen,
        setIsEditOpen,
        isDetailOpen,
        setIsDetailOpen,
        selectedHandbook,
        setSelectedHandbook,
        searchQuery,
        setSearchQuery,
        handleView,
        submitHandbook,
        updateHandbook,
        deleteHandbook,
    };
}
