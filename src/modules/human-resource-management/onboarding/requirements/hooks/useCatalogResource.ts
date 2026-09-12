"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { CatalogClient } from "../providers/requirementsCatalogClient";
import type {
  RequirementsListQuery,
  RequirementsReorderEntry,
} from "../types/requirements-catalog.schema";

// useCatalogResource.ts — client state (rows + loading/error) for ONE catalog
// over its `CatalogClient`. Kept generic so all four requirements catalogs
// share the exact same read/mutate lifecycle: a read-only GET on mount, an
// error state instead of a crash on a failed response, and mutations that
// refresh the list only when a caller explicitly invokes them.

export interface CatalogResource<T, C, U> {
  rows: T[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  create: (data: C) => Promise<T>;
  update: (id: number, data: U) => Promise<T>;
  /** Soft delete (`is_active=0`); the row stays readable with `?all=1`. */
  softDelete: (id: number) => Promise<void>;
  reorder: (order: readonly RequirementsReorderEntry[]) => Promise<void>;
}

/**
 * Client state for one requirements catalog.
 * @param client Stable module-level catalog client.
 * @param options Stable list query (e.g. `{ all: true }`).
 * @returns Rows, loading/error flags, and the CRUD actions.
 */
export function useCatalogResource<T, C, U>(
  client: CatalogClient<T, C, U>,
  options?: RequirementsListQuery
): CatalogResource<T, C, U> {
  const [rows, setRows] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      setError(null);
      setRows(await client.list(options));
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [client, options]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const create = useCallback(
    async (data: C) => {
      const created = await client.create(data);
      await refetch();
      return created;
    },
    [client, refetch]
  );

  const update = useCallback(
    async (id: number, data: U) => {
      const updated = await client.update(id, data);
      await refetch();
      return updated;
    },
    [client, refetch]
  );

  const softDelete = useCallback(
    async (id: number) => {
      await client.softDelete(id);
      await refetch();
    },
    [client, refetch]
  );

  const reorder = useCallback(
    async (order: readonly RequirementsReorderEntry[]) => {
      await client.reorder(order);
      await refetch();
    },
    [client, refetch]
  );

  return useMemo(
    () => ({
      rows,
      isLoading,
      isError,
      error,
      refetch,
      create,
      update,
      softDelete,
      reorder,
    }),
    [
      rows,
      isLoading,
      isError,
      error,
      refetch,
      create,
      update,
      softDelete,
      reorder,
    ]
  );
}
