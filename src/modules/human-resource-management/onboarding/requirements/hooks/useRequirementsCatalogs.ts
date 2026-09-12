"use client";

import { useCallback, useMemo } from "react";

import {
  useRequirementsCatalogFetch,
  type RequirementsCatalogFetchContextType,
} from "../providers/requirementsCatalogProvider";

// useRequirementsCatalogs.ts — consumer hook over the four-catalog fetch
// provider. Adds whole-surface loading/error aggregation and a combined
// refetch, so a screen can render one skeleton and one error banner instead of
// wiring per-catalog flags by hand.

export interface UseRequirementsCatalogsResult
  extends RequirementsCatalogFetchContextType {
  /** True while any catalog is loading. */
  isLoading: boolean;
  /** True when any catalog failed; inspect the catalog's `error` for detail. */
  isError: boolean;
  refetchAll: () => Promise<void>;
}

/**
 * Aggregated view of the requirements catalogs for the admin sections.
 * @returns The four catalog resources plus combined loading/error/refetch.
 */
export function useRequirementsCatalogs(): UseRequirementsCatalogsResult {
  const { documents, orientation, equipment, taskTemplates } =
    useRequirementsCatalogFetch();

  const isLoading =
    documents.isLoading ||
    orientation.isLoading ||
    equipment.isLoading ||
    taskTemplates.isLoading;
  const isError =
    documents.isError ||
    orientation.isError ||
    equipment.isError ||
    taskTemplates.isError;

  const refetchAll = useCallback(async () => {
    await Promise.all([
      documents.refetch(),
      orientation.refetch(),
      equipment.refetch(),
      taskTemplates.refetch(),
    ]);
  }, [documents, orientation, equipment, taskTemplates]);

  return useMemo(
    () => ({
      documents,
      orientation,
      equipment,
      taskTemplates,
      isLoading,
      isError,
      refetchAll,
    }),
    [
      documents,
      orientation,
      equipment,
      taskTemplates,
      isLoading,
      isError,
      refetchAll,
    ]
  );
}
