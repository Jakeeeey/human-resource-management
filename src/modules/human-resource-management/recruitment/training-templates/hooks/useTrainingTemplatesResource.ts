"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { trainingTemplatesClient } from "../providers/trainingTemplatesCatalogClient";
import type {
  CreateTrainingTemplateInput,
  TemplateWithItems,
  TrainingTemplateRow,
  UpdateTrainingTemplateInput,
} from "../types/training-templates.schema";

// useTrainingTemplatesResource.ts — client state (rows + loading/error) for the
// training TEMPLATES list. Mirrors the requirements `useCatalogResource`
// lifecycle: a read-only GET on mount, an error state instead of a crash, and
// mutations that await the client call and then refetch (no optimistic path).
// The admin surface manages deactivated rows too, so the list is always `?all=1`.

const LIST_ALL = { all: true } as const;

export interface TrainingTemplatesResource {
  rows: TemplateWithItems[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  create: (data: CreateTrainingTemplateInput) => Promise<TrainingTemplateRow>;
  update: (
    id: number,
    data: UpdateTrainingTemplateInput
  ) => Promise<TrainingTemplateRow>;
  /** Soft delete (`is_active=0`); the row stays readable with `?all=1`. */
  softDelete: (id: number) => Promise<TrainingTemplateRow>;
}

/**
 * Client state for the training-templates catalog.
 * @returns Rows, loading/error flags, and the CRUD actions.
 */
export function useTrainingTemplatesResource(): TrainingTemplatesResource {
  const [rows, setRows] = useState<TemplateWithItems[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      setError(null);
      setRows(await trainingTemplatesClient.listTemplates(LIST_ALL));
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const create = useCallback(
    async (data: CreateTrainingTemplateInput) => {
      const created = await trainingTemplatesClient.createTemplate(data);
      await refetch();
      return created;
    },
    [refetch]
  );

  const update = useCallback(
    async (id: number, data: UpdateTrainingTemplateInput) => {
      const updated = await trainingTemplatesClient.updateTemplate(id, data);
      await refetch();
      return updated;
    },
    [refetch]
  );

  const softDelete = useCallback(
    async (id: number) => {
      const deleted = await trainingTemplatesClient.softDeleteTemplate(id);
      await refetch();
      return deleted;
    },
    [refetch]
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
