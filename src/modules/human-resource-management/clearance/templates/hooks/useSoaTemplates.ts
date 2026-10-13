"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
    createSoaTemplate as createRow,
    deactivateSoaTemplate as deactivateRow,
    listSoaTemplates,
    updateSoaTemplate as updateRow,
    type SoaTemplateCreateInput,
    type SoaTemplateUpdateInput,
} from "../providers/soaTemplatesClient";
import type { SoaTemplate } from "../types";

export interface SoaTemplatesResource {
    data: SoaTemplate[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    create: (input: SoaTemplateCreateInput) => Promise<SoaTemplate>;
    update: (id: number, input: SoaTemplateUpdateInput) => Promise<SoaTemplate>;
    setActive: (id: number, active: boolean) => Promise<SoaTemplate>;
}

export function useSoaTemplates(includeInactive: boolean): SoaTemplatesResource {
    const [data, setData] = useState<SoaTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        try {
            setIsLoading(true);
            setIsError(false);
            setError(null);
            setData(await listSoaTemplates(includeInactive));
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
        async (input: SoaTemplateCreateInput) => {
            const created = await createRow(input);
            await refresh();
            return created;
        },
        [refresh]
    );

    const update = useCallback(
        async (id: number, input: SoaTemplateUpdateInput) => {
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
