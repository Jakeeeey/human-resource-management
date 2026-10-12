"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import {
  useDepartmentsResource,
  type DepartmentsResource,
} from "../hooks/useDepartmentsResource";
import {
  useTrainingItemsResource,
  type TrainingItemsResource,
} from "../hooks/useTrainingItemsResource";
import {
  useTrainingTemplatesResource,
  type TrainingTemplatesResource,
} from "../hooks/useTrainingTemplatesResource";
import type { TemplateWithItems } from "../types/training-templates.schema";

// trainingTemplatesProvider.tsx — client fetch layer for the master-detail
// training-templates catalog. It owns the template list, the departments used
// by the template selector, the selected template, and that template's items,
// so the master list and the detail panel read one source of truth. Mutations
// live on the two resources (await + refetch) — never on this provider.

export interface TrainingTemplatesCatalogFetchContextType {
  templates: TrainingTemplatesResource;
  items: TrainingItemsResource;
  departments: DepartmentsResource;
  selectedTemplate: TemplateWithItems | null;
  selectedTemplateId: number | null;
  selectTemplate: (id: number | null) => void;
}

const TrainingTemplatesCatalogFetchContext = createContext<
  TrainingTemplatesCatalogFetchContextType | undefined
>(undefined);

export function TrainingTemplatesProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const templates = useTrainingTemplatesResource();
  const departments = useDepartmentsResource();
  const [explicitTemplateId, setExplicitTemplateId] = useState<number | null>(
    null
  );

  // Selection is DERIVED, never synced in an effect: an explicit pick wins when
  // it still exists in the list, otherwise the first template is selected. That
  // lands the detail pane on the first template as soon as the list arrives and
  // recovers automatically if a selection ever leaves the list.
  const selectedTemplateId = useMemo(() => {
    if (
      explicitTemplateId !== null &&
      templates.rows.some((row) => row.id === explicitTemplateId)
    ) {
      return explicitTemplateId;
    }
    return templates.rows[0]?.id ?? null;
  }, [explicitTemplateId, templates.rows]);

  const items = useTrainingItemsResource(selectedTemplateId);

  const selectedTemplate = useMemo(
    () => templates.rows.find((row) => row.id === selectedTemplateId) ?? null,
    [templates.rows, selectedTemplateId]
  );

  const selectTemplate = useCallback((id: number | null) => {
    setExplicitTemplateId(id);
  }, []);

  const value = useMemo(
    () => ({
      templates,
      items,
      departments,
      selectedTemplate,
      selectedTemplateId,
      selectTemplate,
    }),
    [
      templates,
      items,
      departments,
      selectedTemplate,
      selectedTemplateId,
      selectTemplate,
    ]
  );

  return (
    <TrainingTemplatesCatalogFetchContext.Provider value={value}>
      {children}
    </TrainingTemplatesCatalogFetchContext.Provider>
  );
}

/**
 * Raw access to the training-templates fetch provider.
 * @returns The template/item/department resources and the selection.
 * @throws When used outside `TrainingTemplatesProvider`.
 */
export function useTrainingTemplatesCatalogFetch(): TrainingTemplatesCatalogFetchContextType {
  const ctx = useContext(TrainingTemplatesCatalogFetchContext);
  if (!ctx) {
    throw new Error(
      "useTrainingTemplatesCatalogFetch must be used inside TrainingTemplatesProvider"
    );
  }
  return ctx;
}
