"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CampaignStatus, MsCampaignCreateBody, MsCampaignRow, MsCampaignUpdateBody } from "../types";
import {
    CAMPAIGNS_PAGE_SIZE,
    cancelCampaign,
    confirmCampaign,
    createCampaign,
    deleteCampaign,
    expandCampaign,
    listCampaigns,
    scheduleCampaign,
    testSendCampaign,
    updateCampaign,
} from "../providers/campaignsClient";
import type {
    CampaignCancelData,
    CampaignConfirmCounts,
    CampaignExpandData,
    CampaignSort,
    CampaignTestSendData,
} from "../providers/campaignsClient";

export type CampaignStatusFilter = CampaignStatus | "all";

export interface CampaignsQuery {
    page: number;
    limit: number;
    status: CampaignStatusFilter;
    search: string;
    sort: CampaignSort;
}

const DEFAULT_QUERY: CampaignsQuery = {
    page: 1,
    limit: CAMPAIGNS_PAGE_SIZE,
    status: "all",
    search: "",
    sort: "created-desc",
};

export interface CampaignConfirmState {
    id: number;
    counts: CampaignConfirmCounts;
}

export interface CampaignExpandState {
    id: number;
    outcome: CampaignExpandData;
    repeated: boolean;
}

export interface CampaignTestState {
    id: number;
    outcome: CampaignTestSendData;
}

export interface CampaignCancelState {
    id: number;
    outcome: CampaignCancelData;
}

export interface CampaignScheduleState {
    id: number;
    outcome: MsCampaignRow;
}

export interface UseCampaignsResult {
    data: MsCampaignRow[] | null;
    total: number;
    query: CampaignsQuery;
    setQuery: (patch: Partial<CampaignsQuery>) => void;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    actionError: string | null;
    notice: string | null;
    busyKey: string | null;
    confirmState: CampaignConfirmState | null;
    expandState: CampaignExpandState | null;
    testState: CampaignTestState | null;
    cancelState: CampaignCancelState | null;
    scheduleState: CampaignScheduleState | null;
    clearOutcome: () => void;
    dismissNotice: () => void;
    createItem: (input: MsCampaignCreateBody) => Promise<MsCampaignRow | null>;
    updateItem: (id: number, patch: MsCampaignUpdateBody) => Promise<MsCampaignRow | null>;
    removeItem: (id: number) => Promise<boolean>;
    confirmItem: (id: number) => Promise<CampaignConfirmState | null>;
    expandItem: (id: number) => Promise<CampaignExpandState | null>;
    cancelItem: (id: number) => Promise<CampaignCancelState | null>;
    scheduleItem: (id: number, scheduledAt: string | null) => Promise<CampaignScheduleState | null>;
    testSendItem: (id: number, seeds: string[]) => Promise<CampaignTestState | null>;
}

function toMessage(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}

export function useCampaigns(): UseCampaignsResult {
    const [data, setData] = useState<MsCampaignRow[] | null>(null);
    const [total, setTotal] = useState(0);
    const [query, setQueryState] = useState<CampaignsQuery>(DEFAULT_QUERY);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [confirmState, setConfirmState] = useState<CampaignConfirmState | null>(null);
    const [expandState, setExpandState] = useState<CampaignExpandState | null>(null);
    const [testState, setTestState] = useState<CampaignTestState | null>(null);
    const [cancelState, setCancelState] = useState<CampaignCancelState | null>(null);
    const [scheduleState, setScheduleState] = useState<CampaignScheduleState | null>(null);
    const requestSeq = useRef(0);

    const setQuery = useCallback((patch: Partial<CampaignsQuery>): void => {
        setQueryState((prev) => {
            const next: CampaignsQuery = { ...prev, ...patch };
            if (
                patch.page === undefined &&
                (patch.status !== undefined || patch.search !== undefined || patch.sort !== undefined || patch.limit !== undefined)
            ) {
                next.page = 1;
            }
            if (
                next.page === prev.page &&
                next.limit === prev.limit &&
                next.status === prev.status &&
                next.search === prev.search &&
                next.sort === prev.sort
            ) {
                return prev;
            }
            return next;
        });
    }, []);

    const load = useCallback(async (loud: boolean): Promise<void> => {
        const seq = requestSeq.current + 1;
        requestSeq.current = seq;
        if (loud) setIsLoading(true);
        setError(null);
        try {
            const search = query.search.trim();
            const result = await listCampaigns({
                page: query.page,
                limit: query.limit,
                sort: query.sort,
                ...(query.status === "all" ? {} : { status: query.status }),
                ...(search === "" ? {} : { search }),
            });
            if (requestSeq.current !== seq) return;
            setData(result.rows);
            setTotal(result.total);
        } catch (cause) {
            if (requestSeq.current !== seq) return;
            setError(toMessage(cause));
        } finally {
            if (requestSeq.current === seq && loud) setIsLoading(false);
        }
    }, [query]);

    useEffect(() => {
        void load(true);
    }, [load]);

    const refresh = useCallback(async (): Promise<void> => {
        await load(true);
    }, [load]);

    const clearOutcome = useCallback((): void => {
        setConfirmState(null);
        setExpandState(null);
        setTestState(null);
        setCancelState(null);
        setScheduleState(null);
        setNotice(null);
        setActionError(null);
    }, []);

    const dismissNotice = useCallback((): void => {
        setNotice(null);
    }, []);

    const createItem = useCallback(async (input: MsCampaignCreateBody): Promise<MsCampaignRow | null> => {
        setBusyKey("create");
        setActionError(null);
        setNotice(null);
        try {
            const row = await createCampaign(input);
            await load(false);
            return row;
        } catch (cause) {
            setActionError(toMessage(cause));
            return null;
        } finally {
            setBusyKey(null);
        }
    }, [load]);

    const updateItem = useCallback(async (id: number, patch: MsCampaignUpdateBody): Promise<MsCampaignRow | null> => {
        setBusyKey(`update:${id}`);
        setActionError(null);
        setNotice(null);
        try {
            const row = await updateCampaign(id, patch);
            await load(false);
            return row;
        } catch (cause) {
            setActionError(toMessage(cause));
            return null;
        } finally {
            setBusyKey(null);
        }
    }, [load]);

    const removeItem = useCallback(async (id: number): Promise<boolean> => {
        setBusyKey(`delete:${id}`);
        setActionError(null);
        setNotice(null);
        try {
            await deleteCampaign(id);
            await load(false);
            return true;
        } catch (cause) {
            setActionError(toMessage(cause));
            return false;
        } finally {
            setBusyKey(null);
        }
    }, [load]);

    const confirmItem = useCallback(async (id: number): Promise<CampaignConfirmState | null> => {
        setBusyKey(`confirm:${id}`);
        setActionError(null);
        setNotice(null);
        try {
            const counts = await confirmCampaign(id);
            const state = { id, counts };
            setConfirmState(state);
            return state;
        } catch (cause) {
            setActionError(toMessage(cause));
            return null;
        } finally {
            setBusyKey(null);
        }
    }, []);

    const expandItem = useCallback(async (id: number): Promise<CampaignExpandState | null> => {
        setBusyKey(`expand:${id}`);
        setActionError(null);
        setNotice(null);
        try {
            const { data: outcome, repeated } = await expandCampaign(id);
            const state = { id, outcome, repeated };
            setExpandState(state);
            if (repeated) {
                setNotice("Already queued — this campaign was expanded before. Showing the existing queue instead of a new one.");
            }
            await load(false);
            return state;
        } catch (cause) {
            setActionError(toMessage(cause));
            return null;
        } finally {
            setBusyKey(null);
        }
    }, [load]);

    const cancelItem = useCallback(async (id: number): Promise<CampaignCancelState | null> => {
        setBusyKey(`cancel:${id}`);
        setActionError(null);
        setNotice(null);
        try {
            const outcome = await cancelCampaign(id);
            const state = { id, outcome };
            setCancelState(state);
            await load(false);
            return state;
        } catch (cause) {
            setActionError(toMessage(cause));
            return null;
        } finally {
            setBusyKey(null);
        }
    }, [load]);

    const scheduleItem = useCallback(async (id: number, scheduledAt: string | null): Promise<CampaignScheduleState | null> => {
        setBusyKey(`schedule:${id}`);
        setActionError(null);
        setNotice(null);
        try {
            const outcome = await scheduleCampaign(id, scheduledAt);
            const state = { id, outcome };
            setScheduleState(state);
            setNotice(
                scheduledAt === null
                    ? "Schedule removed — the campaign is a draft again."
                    : "Send scheduled — the campaign will go out automatically at the chosen time."
            );
            await load(false);
            return state;
        } catch (cause) {
            setActionError(toMessage(cause));
            return null;
        } finally {
            setBusyKey(null);
        }
    }, [load]);

    const testSendItem = useCallback(async (id: number, seeds: string[]): Promise<CampaignTestState | null> => {
        setBusyKey(`test:${id}`);
        setActionError(null);
        try {
            const outcome = await testSendCampaign(id, seeds);
            const state = { id, outcome };
            setTestState(state);
            return state;
        } catch (cause) {
            setActionError(toMessage(cause));
            return null;
        } finally {
            setBusyKey(null);
        }
    }, []);

    return {
        data,
        total,
        query,
        setQuery,
        isLoading,
        error,
        refresh,
        actionError,
        notice,
        busyKey,
        confirmState,
        expandState,
        testState,
        cancelState,
        scheduleState,
        clearOutcome,
        dismissNotice,
        createItem,
        updateItem,
        removeItem,
        confirmItem,
        expandItem,
        cancelItem,
        scheduleItem,
        testSendItem,
    };
}
