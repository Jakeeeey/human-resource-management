"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
    getSalesmanApprovalData,
    approveSalesmanDraft,
    rejectSalesmanDraft,
} from "../providers/fetchProvider";
import type {
    SalesmanDraftWithRelations,
    User,
    Division,
    Branch,
    Operation,
    PriceType,
} from "../types";

export function useSalesmanApproval() {
    const [drafts, setDrafts] = useState<SalesmanDraftWithRelations[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [divisions, setDivisions] = useState<Division[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [badBranches, setBadBranches] = useState<Branch[]>([]);
    const [operations, setOperations] = useState<Operation[]>([]);
    const [priceTypes, setPriceTypes] = useState<PriceType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const hasLoadedRef = useRef(false);

    const fetchData = useCallback(async (showLoading = false) => {
        try {
            if (showLoading || !hasLoadedRef.current) {
                setIsLoading(true);
            }

            const data = await getSalesmanApprovalData();
            setDrafts(data.drafts || []);
            setUsers(data.users || []);
            setDivisions(data.divisions || []);
            setBranches(data.branches || []);
            setBadBranches(data.badBranches || []);
            setOperations(data.operations || []);
            setPriceTypes(data.priceTypes || []);
            hasLoadedRef.current = true;
        } catch (err) {
            setIsError(true);
            setError(err instanceof Error ? err : new Error("Unknown error"));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(true);
    }, [fetchData]);

    useEffect(() => {
        const handleFocus = () => fetchData(false);
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, [fetchData]);

    const approveDraft = useCallback(
        async (id: number, data?: Record<string, unknown>) => {
            await approveSalesmanDraft(id, data);
            await fetchData(false);
        },
        [fetchData]
    );

    const rejectDraft = useCallback(
        async (id: number) => {
            await rejectSalesmanDraft(id);
            await fetchData(false);
        },
        [fetchData]
    );

    return {
        drafts,
        users,
        divisions,
        branches,
        badBranches,
        operations,
        priceTypes,
        isLoading,
        isError,
        error,
        refetch: () => fetchData(true),
        approveDraft,
        rejectDraft,
    };
}
