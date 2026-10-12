"use client";

import { useCallback, useMemo } from "react";

import {
  useTrainingTemplatesCatalogFetch,
  type TrainingTemplatesCatalogFetchContextType,
} from "../providers/trainingTemplatesProvider";

// useTrainingTemplatesCatalog.ts — consumer hook over the master-detail fetch
// provider. Adds whole-surface loading/error aggregation plus a combined
// refetch so a screen can render one skeleton/banner instead of wiring per-
// resource flags by hand (mirrors `useRequirementsCatalogs`).

export interface UseTrainingTemplatesCatalogResult
  extends TrainingTemplatesCatalogFetchContextType {
  /** True while any resource is loading. */
  isLoading: boolean;
  /** True when any resource failed; inspect the resource's `error` for detail. */
  isError: boolean;
  refetchAll: () => Promise<void>;
}

/**
 * Aggregated view of the training-templates catalog for the admin surfaces.
 * @returns The resources plus combined loading/error/refetch.
 */
export function useTrainingTemplatesCatalog(): UseTrainingTemplatesCatalogResult {
  const ctx = useTrainingTemplatesCatalogFetch();
  const { templates, items, departments } = ctx;

  const isLoading =
    templates.isLoading || items.isLoading || departments.isLoading;
  const isError = templates.isError || items.isError || departments.isError;

  const refetchAll = useCallback(async () => {
    await Promise.all([
      templates.refetch(),
      items.refetch(),
      departments.refetch(),
    ]);
  }, [templates, items, departments]);

  return useMemo(
    () => ({ ...ctx, isLoading, isError, refetchAll }),
    [ctx, isLoading, isError, refetchAll]
  );
}
