"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { trainingTemplatesClient } from "../providers/trainingTemplatesCatalogClient";
import type {
  CreateTrainingItemInput,
  TrainingItemRow,
  UpdateTrainingItemInput,
} from "../types/training-templates.schema";

// useTrainingItemsResource.ts — client state (rows + loading/error) for the
// ITEMS of ONE selected template. `templateId === null` is the "nothing
// selected" state: no request, empty rows. Mutations await the API and refetch;
// there is no optimistic path.

const LIST_ALL = { all: true } as const;

export interface TrainingItemsResource {
  rows: TrainingItemRow[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  create: (data: CreateTrainingItemInput) => Promise<TrainingItemRow>;
  update: (
    itemId: number,
    data: UpdateTrainingItemInput
  ) => Promise<TrainingItemRow>;
  /** Soft delete (`is_active=0`); the item stays readable with `?all=1`. */
  softDelete: (itemId: number) => Promise<TrainingItemRow>;
}

/**
 * Client state for the items of one training template.
 * @param templateId Selected template id, or null when none is selected.
 * @returns Rows, loading/error flags, and the CRUD actions.
 */
export function useTrainingItemsResource(
  templateId: number | null
): TrainingItemsResource {
  const [rows, setRows] = useState<TrainingItemRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (templateId === null) {
      setRows([]);
      setIsLoading(false);
      setIsError(false);
      setError(null);
      return;
    }
    try {
      setIsLoading(true);
      setIsError(false);
      setError(null);
      setRows(await trainingTemplatesClient.listItems(templateId, LIST_ALL));
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const create = useCallback(
    async (data: CreateTrainingItemInput) => {
      if (templateId === null) {
        throw new Error("Select a training template first");
      }
      const created = await trainingTemplatesClient.createItem(templateId, data);
      await refetch();
      return created;
    },
    [templateId, refetch]
  );

  const update = useCallback(
    async (itemId: number, data: UpdateTrainingItemInput) => {
      if (templateId === null) {
        throw new Error("Select a training template first");
      }
      const updated = await trainingTemplatesClient.updateItem(
        templateId,
        itemId,
        data
      );
      await refetch();
      return updated;
    },
    [templateId, refetch]
  );

  const softDelete = useCallback(
    async (itemId: number) => {
      if (templateId === null) {
        throw new Error("Select a training template first");
      }
      const deleted = await trainingTemplatesClient.softDeleteItem(
        templateId,
        itemId
      );
      await refetch();
      return deleted;
    },
    [templateId, refetch]
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
    }),
    [rows, isLoading, isError, error, refetch, create, update, softDelete]
  );
}
