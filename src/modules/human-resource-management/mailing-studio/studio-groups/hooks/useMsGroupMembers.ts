"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchMsGroupMembers } from "../providers/msGroupsClient";
import type { MemberSort, MsGroupMemberRow } from "../types";
import { useMsPagination } from "./useMsPagination";

export const MS_GROUP_MEMBERS_PAGE_SIZE = 25;

export interface UseMsGroupMembersResult {
    data: MsGroupMemberRow[] | null;
    total: number;
    page: number;
    totalPages: number;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    setPage: (page: number) => void;
    resetPage: () => void;
}

export function useMsGroupMembers(groupId: number | null, sort: MemberSort = "added-desc"): UseMsGroupMembersResult {
    const [data, setData] = useState<MsGroupMemberRow[] | null>(null);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(groupId !== null);
    const [error, setError] = useState<string | null>(null);
    const { page, totalPages, setPage, resetPage } = useMsPagination(total, MS_GROUP_MEMBERS_PAGE_SIZE);

    const refresh = useCallback(async (): Promise<void> => {
        if (groupId === null) {
            setData(null);
            setTotal(0);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const result = await fetchMsGroupMembers(groupId, { page, limit: MS_GROUP_MEMBERS_PAGE_SIZE, sort });
            setData(result.rows);
            setTotal(result.total);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setIsLoading(false);
        }
    }, [groupId, page, sort]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { data, total, page, totalPages, isLoading, error, refresh, setPage, resetPage };
}
