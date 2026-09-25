"use client";

import { useCallback, useEffect, useState } from "react";

import {
    createMsBinding,
    deleteMsBinding,
    fetchMsBindings,
    patchMsBinding,
    type MsBindingCreate,
    type MsBindingPatch,
    type MsBindingRow,
} from "../providers/msBindings";

export interface UseMsBindingsResult {
    data: MsBindingRow[] | null;
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    create: (input: MsBindingCreate) => Promise<MsBindingRow | null>;
    update: (id: string | number, patch: MsBindingPatch) => Promise<MsBindingRow | null>;
    remove: (id: string | number) => Promise<boolean>;
}

/**
 * Manages event→template bindings via the real bindings routes.
 * @returns { data, isLoading, error, refetch } plus create/update/remove —
 * each mutation refetches the list on success and surfaces route errors as
 * thrown Error messages resolved to null/false (error state holds the text).
 */
export function useMsBindings(): UseMsBindingsResult {
    const [data, setData] = useState<MsBindingRow[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await fetchMsBindings());
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void refetch();
    }, [refetch]);

    const create = useCallback(
        async (input: MsBindingCreate): Promise<MsBindingRow | null> => {
            setError(null);
            try {
                const row = await createMsBinding(input);
                await refetch();
                return row;
            } catch (cause) {
                setError(cause instanceof Error ? cause.message : String(cause));
                return null;
            }
        },
        [refetch],
    );

    const update = useCallback(
        async (id: string | number, patch: MsBindingPatch): Promise<MsBindingRow | null> => {
            setError(null);
            try {
                const row = await patchMsBinding(id, patch);
                await refetch();
                return row;
            } catch (cause) {
                setError(cause instanceof Error ? cause.message : String(cause));
                return null;
            }
        },
        [refetch],
    );

    const remove = useCallback(
        async (id: string | number): Promise<boolean> => {
            setError(null);
            try {
                await deleteMsBinding(id);
                await refetch();
                return true;
            } catch (cause) {
                setError(cause instanceof Error ? cause.message : String(cause));
                return false;
            }
        },
        [refetch],
    );

    return { data, isLoading, error, refetch, create, update, remove };
}
