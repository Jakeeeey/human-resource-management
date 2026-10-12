"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
    createCategory as createRow,
    deactivateCategory as deactivateRow,
    listCategories,
    listCategorySignatories,
    reorderCategories,
    updateCategory as updateRow,
    type CategoryCreateInput,
    type CategoryUpdateInput,
    type ClearanceReorderEntry,
} from "../providers/clearanceTemplatesClient";
import type { ClearanceCategory } from "../types";

export interface TemplateCategoriesResource {
    data: ClearanceCategory[];
    poolCounts: Record<number, number>;
    poolMembers: Record<number, number[]>;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    create: (input: CategoryCreateInput) => Promise<ClearanceCategory>;
    update: (id: number, input: CategoryUpdateInput) => Promise<ClearanceCategory>;
    setActive: (id: number, active: boolean) => Promise<ClearanceCategory>;
    move: (id: number, direction: -1 | 1) => Promise<void>;
}

function buildOrder(rows: readonly ClearanceCategory[], id: number, direction: -1 | 1): ClearanceReorderEntry[] | null {
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

export function useTemplateCategories(
    templateId: number | null,
    includeInactive: boolean
): TemplateCategoriesResource {
    const [data, setData] = useState<ClearanceCategory[]>([]);
    const [poolCounts, setPoolCounts] = useState<Record<number, number>>({});
    const [poolMembers, setPoolMembers] = useState<Record<number, number[]>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        if (templateId === null) {
            setData([]);
            setPoolCounts({});
            setPoolMembers({});
            setIsLoading(false);
            setIsError(false);
            setError(null);
            return;
        }
        try {
            setIsLoading(true);
            setIsError(false);
            setError(null);
            const rows = await listCategories(templateId, includeInactive);
            setData(rows);
            const poolIds = rows.filter((row) => row.signer_type === "pool").map((row) => row.id);
            const entries = await Promise.all(
                poolIds.map(async (id) => {
                    try {
                        const signatories = await listCategorySignatories(templateId, id);
                        return {
                            id,
                            count: signatories.length,
                            userIds: signatories.map((row) => row.user_id),
                        };
                    } catch {
                        return null;
                    }
                })
            );
            const next: Record<number, number> = {};
            const members: Record<number, number[]> = {};
            for (const entry of entries) {
                if (entry !== null) {
                    next[entry.id] = entry.count;
                    members[entry.id] = entry.userIds;
                }
            }
            setPoolCounts(next);
            setPoolMembers(members);
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
        async (input: CategoryCreateInput) => {
            if (templateId === null) {
                throw new Error("Select a template before adding a category");
            }
            const created = await createRow(templateId, input);
            await refresh();
            return created;
        },
        [templateId, refresh]
    );

    const update = useCallback(
        async (id: number, input: CategoryUpdateInput) => {
            if (templateId === null) {
                throw new Error("Select a template before editing a category");
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
                throw new Error("Select a template before changing a category");
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
                throw new Error("Select a template before reordering categories");
            }
            const order = buildOrder(data, id, direction);
            if (order === null) {
                return;
            }
            await reorderCategories(templateId, order);
            await refresh();
        },
        [templateId, data, refresh]
    );

    return useMemo(
        () => ({ data, poolCounts, poolMembers, isLoading, isError, error, refresh, create, update, setActive, move }),
        [data, poolCounts, poolMembers, isLoading, isError, error, refresh, create, update, setActive, move]
    );
}
