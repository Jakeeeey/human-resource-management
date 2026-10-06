"use client";

import { useCallback, useEffect, useState } from "react";

import type { MsCampaignCreateBody, MsCampaignRow, MsCampaignUpdateBody } from "../types";
import {
    cancelCampaign,
    confirmCampaign,
    createCampaign,
    deleteCampaign,
    expandCampaign,
    listCampaigns,
    testSendCampaign,
    updateCampaign,
} from "../providers/campaignsClient";
import type {
    CampaignCancelData,
    CampaignConfirmCounts,
    CampaignExpandData,
    CampaignTestSendData,
} from "../providers/campaignsClient";

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

export interface UseCampaignsResult {
    data: MsCampaignRow[] | null;
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
    clearOutcome: () => void;
    createItem: (input: MsCampaignCreateBody) => Promise<MsCampaignRow | null>;
    updateItem: (id: number, patch: MsCampaignUpdateBody) => Promise<MsCampaignRow | null>;
    removeItem: (id: number) => Promise<boolean>;
    confirmItem: (id: number) => Promise<CampaignConfirmState | null>;
    expandItem: (id: number) => Promise<CampaignExpandState | null>;
    cancelItem: (id: number) => Promise<CampaignCancelState | null>;
    testSendItem: (id: number, seeds: string[]) => Promise<CampaignTestState | null>;
}

function toMessage(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}

export function useCampaigns(): UseCampaignsResult {
    const [data, setData] = useState<MsCampaignRow[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [confirmState, setConfirmState] = useState<CampaignConfirmState | null>(null);
    const [expandState, setExpandState] = useState<CampaignExpandState | null>(null);
    const [testState, setTestState] = useState<CampaignTestState | null>(null);
    const [cancelState, setCancelState] = useState<CampaignCancelState | null>(null);

    const load = useCallback(async (loud: boolean): Promise<void> => {
        if (loud) setIsLoading(true);
        setError(null);
        try {
            setData(await listCampaigns());
        } catch (cause) {
            setError(toMessage(cause));
        } finally {
            if (loud) setIsLoading(false);
        }
    }, []);

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
        setNotice(null);
        setActionError(null);
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
        clearOutcome,
        createItem,
        updateItem,
        removeItem,
        confirmItem,
        expandItem,
        cancelItem,
        testSendItem,
    };
}
