"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
    createSoaRow as createRow,
    deactivateSoaRow as deactivateRow,
    listSoaRows,
    reorderSoaRows,
    updateSoaRow as updateRow,
    type SoaReorderEntry,
    type SoaRowCreateInput,
    type SoaRowUpdateInput,
} from "../providers/soaTemplatesClient";
import type { SoaTemplateRow } from "../types";

export interface SoaTemplateRowsResource {
    data: SoaTemplateRow[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    create: (input: SoaRowCreateInput) => Promise<SoaTemplateRow>;
    update: (id: number, input: SoaRowUpdateInput) => Promise<SoaTemplateRow>;
    setActive: (id: number, active: boolean) => Promise<SoaTemplateRow>;
    move: (id: number, direction: -1 | 1) => Promise<void>;
}

function buildOrder(rows: readonly SoaTemplateRow[], id: number, direction: -1 | 1): SoaReorderEntry[] | null {
    const index = rows.findIndex((row) => row.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= rows.length) {
        return null;
    }
    const next = [...rows];
    const current = next[index];
    next[index] = next[target];
    next[target] = current;
    return next.map((row, position) => ({ id: row.id, sort_order: (position + 1) * 10 }));
}

export function useSoaTemplateRows(
    templateId: number | null,
    includeInactive: boolean
): SoaTemplateRowsResource {
    const [data, setData] = useState<SoaTemplateRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        if (templateId === null) {
            setData([]);
            setIsLoading(false);
            setIsError(false);
            setError(null);
            return;
        }
        try {
            setIsLoading(true);
            setIsError(false);
            setError(null);
            setData(await listSoaRows(templateId, includeInactive));
        } catch (err) {
            setIsError(true);
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setIsLoading(false);
        }
    }, [templateId, includeInactive]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const create = useCallback(
        async (input: SoaRowCreateInput) => {
            if (templateId === null) {
                throw new Error("Select an SOA template before adding a row");
            }
            const created = await createRow(templateId, input);
            await refresh();
            return created;
        },
        [templateId, refresh]
    );

    const update = useCallback(
        async (id: number, input: SoaRowUpdateInput) => {
            if (templateId === null) {
                throw new Error("Select an SOA template before editing a row");
            }
            const updated = await updateRow(templateId, id, input);
            await refresh();
            return updated;
        },
        [templateId, refresh]
    );

    const setActive = useCallback(
        async (id: number, active: boolean) => {
            if (templateId === null) {
                throw new Error("Select an SOA template before changing a row");
            }
            const updated = active
                ? await updateRow(templateId, id, { is_active: true })
                : await deactivateRow(templateId, id);
            await refresh();
            return updated;
        },
        [templateId, refresh]
    );

    const move = useCallback(
        async (id: number, direction: -1 | 1) => {
            if (templateId === null) {
                throw new Error("Select an SOA template before reordering rows");
            }
            const order = buildOrder(data, id, direction);
            if (order === null) {
                return;
            }
            await reorderSoaRows(templateId, order);
            await refresh();
        },
        [templateId, data, refresh]
    );

    return useMemo(
        () => ({ data, isLoading, isError, error, refresh, create, update, setActive, move }),
        [data, isLoading, isError, error, refresh, create, update, setActive, move]
    );
}
