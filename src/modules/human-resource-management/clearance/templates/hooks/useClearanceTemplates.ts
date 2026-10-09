"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
    createTemplate as createRow,
    deactivateTemplate as deactivateRow,
    listTemplates,
    updateTemplate as updateRow,
    type TemplateCreateInput,
    type TemplateUpdateInput,
} from "../providers/clearanceTemplatesClient";
import type { ClearanceTemplate } from "../types";

export interface ClearanceTemplatesResource {
    data: ClearanceTemplate[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    create: (input: TemplateCreateInput) => Promise<ClearanceTemplate>;
    update: (id: number, input: TemplateUpdateInput) => Promise<ClearanceTemplate>;
    setActive: (id: number, active: boolean) => Promise<ClearanceTemplate>;
}

export function useClearanceTemplates(includeInactive: boolean): ClearanceTemplatesResource {
    const [data, setData] = useState<ClearanceTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        try {
            setIsLoading(true);
            setIsError(false);
            setError(null);
            setData(await listTemplates(includeInactive));
        } catch (err) {
            setIsError(true);
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setIsLoading(false);
        }
    }, [includeInactive]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const create = useCallback(
        async (input: TemplateCreateInput) => {
            const created = await createRow(input);
            await refresh();
            return created;
        },
        [refresh]
    );

    const update = useCallback(
        async (id: number, input: TemplateUpdateInput) => {
            const updated = await updateRow(id, input);
            await refresh();
            return updated;
        },
        [refresh]
    );

    const setActive = useCallback(
        async (id: number, active: boolean) => {
            const updated = active ? await updateRow(id, { is_active: true }) : await deactivateRow(id);
            await refresh();
            return updated;
        },
        [refresh]
    );

    return useMemo(
        () => ({ data, isLoading, isError, error, refresh, create, update, setActive }),
        [data, isLoading, isError, error, refresh, create, update, setActive]
    );
}
