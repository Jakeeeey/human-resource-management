"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
    ClearanceFilingClientError,
    getFilingCandidates,
    getFilingDetail,
    getFilingPrintable,
    pickFilingSigner,
    signFilingItem,
    type ClearancePrintable,
    type FilingCandidate,
    type FilingDetail,
    type SignItemInput,
} from "../providers/clearanceFilingClient";

export interface ClearanceFilingState {
    detail: FilingDetail | null;
    printable: ClearancePrintable | null;
    candidatesByItem: Map<number, FilingCandidate[]>;
    failedItems: number[];
    loading: boolean;
    candidatesReady: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    reloadCandidates: () => Promise<void>;
    pick: (itemId: number, userId: number) => Promise<void>;
    sign: (itemId: number, input: SignItemInput) => Promise<void>;
}

function toMessage(error: unknown, fallback: string): string {
    if (error instanceof ClearanceFilingClientError) return error.message;
    if (error instanceof Error && error.message.trim() !== "") return error.message;
    return fallback;
}

export function useClearanceFiling(requestId: number | null): ClearanceFilingState {
    const [detail, setDetail] = useState<FilingDetail | null>(null);
    const [printable, setPrintable] = useState<ClearancePrintable | null>(null);
    const [candidatesByItem, setCandidatesByItem] = useState<Map<number, FilingCandidate[]>>(new Map());
    const [failedItems, setFailedItems] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [candidatesReady, setCandidatesReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(false);
    const autoPickedRef = useRef<Set<number>>(new Set());

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        autoPickedRef.current = new Set();
    }, [requestId]);

    const loadCandidates = useCallback(
        async (items: FilingDetail["items"]): Promise<void> => {
            if (requestId === null || items.length === 0) {
                if (mountedRef.current) {
                    setCandidatesByItem(new Map());
                    setFailedItems([]);
                    setCandidatesReady(true);
                }
                return;
            }
            const results = await Promise.allSettled(
                items.map(async (item) => ({ itemId: item.id, members: await getFilingCandidates(item.id) }))
            );
            if (!mountedRef.current) return;
            const perItem = new Map<number, FilingCandidate[]>();
            const failed: number[] = [];
            for (const result of results) {
                if (result.status === "fulfilled") {
                    perItem.set(result.value.itemId, result.value.members);
                }
            }
            for (const item of items) {
                if (!perItem.has(item.id)) failed.push(item.id);
            }
            setCandidatesByItem(perItem);
            setFailedItems(failed);
            setCandidatesReady(true);
        },
        [requestId]
    );

    const refresh = useCallback(async (): Promise<void> => {
        if (requestId === null) {
            setDetail(null);
            setPrintable(null);
            setCandidatesByItem(new Map());
            setFailedItems([]);
            setError(null);
            setLoading(false);
            setCandidatesReady(true);
            return;
        }
        if (mountedRef.current) {
            setLoading(true);
            setError(null);
        }
        try {
            const [nextDetail, nextPrintable] = await Promise.all([
                getFilingDetail(requestId),
                getFilingPrintable(requestId).catch(() => null),
            ]);
            if (!mountedRef.current) return;
            setDetail(nextDetail);
            setPrintable(nextPrintable);
            setCandidatesReady(false);
            await loadCandidates(nextDetail.items);
        } catch (err) {
            if (!mountedRef.current) return;
            setDetail(null);
            setPrintable(null);
            setCandidatesByItem(new Map());
            setFailedItems([]);
            setCandidatesReady(true);
            setError(toMessage(err, "Could not load your clearance. Please try again."));
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, [requestId, loadCandidates]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const reloadCandidates = useCallback(async (): Promise<void> => {
        if (!detail) return;
        if (mountedRef.current) setCandidatesReady(false);
        await loadCandidates(detail.items);
    }, [detail, loadCandidates]);

    const pick = useCallback(
        async (itemId: number, userId: number): Promise<void> => {
            await pickFilingSigner(itemId, userId);
            await refresh();
        },
        [refresh]
    );

    const sign = useCallback(
        async (itemId: number, input: SignItemInput): Promise<void> => {
            await signFilingItem(itemId, input);
            await refresh();
        },
        [refresh]
    );

    useEffect(() => {
        if (!detail || !candidatesReady || detail.status === "completed") return;
        const pending = detail.items.filter(
            (item) =>
                item.status === "pending" &&
                item.expected_signer_user_id === null &&
                !autoPickedRef.current.has(item.id) &&
                (candidatesByItem.get(item.id) ?? []).length === 1
        );
        if (pending.length === 0) return;
        for (const item of pending) {
            autoPickedRef.current.add(item.id);
            const only = (candidatesByItem.get(item.id) ?? [])[0];
            if (only) {
                pickFilingSigner(item.id, only.user_id)
                    .then(() => refresh())
                    .catch(() => undefined);
            }
        }
    }, [detail, candidatesReady, candidatesByItem, refresh]);

    return {
        detail,
        printable,
        candidatesByItem,
        failedItems,
        loading,
        candidatesReady,
        error,
        refresh,
        reloadCandidates,
        pick,
        sign,
    };
}
