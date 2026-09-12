"use client";

import { createContext, useContext, useMemo } from "react";

import {
  useCatalogResource,
  type CatalogResource,
} from "../hooks/useCatalogResource";
import type {
  CreateDocumentSlotInput,
  CreateEquipmentItemInput,
  CreateOrientationTopicInput,
  CreateTaskTemplateInput,
  DocumentSlotRow,
  EquipmentItemRow,
  OrientationTopicCatalogRow,
  RequirementsListQuery,
  TaskTemplateRow,
  UpdateDocumentSlotInput,
  UpdateEquipmentItemInput,
  UpdateOrientationTopicInput,
  UpdateTaskTemplateInput,
} from "../types/requirements-catalog.schema";
import { createCatalogClient } from "./requirementsCatalogClient";

// requirementsCatalogProvider.tsx — client fetch layer for the four
// requirements catalogs, mirroring the paperwork template provider. Each
// catalog is an independent `CatalogResource` over the shared CRUD client, so
// a failure in one catalog surfaces as that catalog's error state (never a
// crash) while the others still load.

// Stable module-level clients — identity must not change between renders or
// `useCatalogResource` would refetch in a loop.
const documentsClient = createCatalogClient<
  DocumentSlotRow,
  CreateDocumentSlotInput,
  UpdateDocumentSlotInput
>("documents");
const orientationClient = createCatalogClient<
  OrientationTopicCatalogRow,
  CreateOrientationTopicInput,
  UpdateOrientationTopicInput
>("orientation");
const equipmentClient = createCatalogClient<
  EquipmentItemRow,
  CreateEquipmentItemInput,
  UpdateEquipmentItemInput
>("equipment");
const taskTemplatesClient = createCatalogClient<
  TaskTemplateRow,
  CreateTaskTemplateInput,
  UpdateTaskTemplateInput
>("task-templates");

// The admin surface manages deactivated rows too, so the active toggle is
// reversible without the row disappearing on soft delete.
const LIST_ALL: RequirementsListQuery = { all: true };

export type DocumentsResource = CatalogResource<
  DocumentSlotRow,
  CreateDocumentSlotInput,
  UpdateDocumentSlotInput
>;
export type OrientationResource = CatalogResource<
  OrientationTopicCatalogRow,
  CreateOrientationTopicInput,
  UpdateOrientationTopicInput
>;
export type EquipmentResource = CatalogResource<
  EquipmentItemRow,
  CreateEquipmentItemInput,
  UpdateEquipmentItemInput
>;
export type TaskTemplatesResource = CatalogResource<
  TaskTemplateRow,
  CreateTaskTemplateInput,
  UpdateTaskTemplateInput
>;

export interface RequirementsCatalogFetchContextType {
  documents: DocumentsResource;
  orientation: OrientationResource;
  equipment: EquipmentResource;
  taskTemplates: TaskTemplatesResource;
}

const RequirementsCatalogFetchContext = createContext<
  RequirementsCatalogFetchContextType | undefined
>(undefined);

export function RequirementsCatalogFetchProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const documents = useCatalogResource(documentsClient, LIST_ALL);
  const orientation = useCatalogResource(orientationClient, LIST_ALL);
  const equipment = useCatalogResource(equipmentClient, LIST_ALL);
  const taskTemplates = useCatalogResource(taskTemplatesClient, LIST_ALL);

  const value = useMemo(
    () => ({ documents, orientation, equipment, taskTemplates }),
    [documents, orientation, equipment, taskTemplates]
  );

  return (
    <RequirementsCatalogFetchContext.Provider value={value}>
      {children}
    </RequirementsCatalogFetchContext.Provider>
  );
}

/**
 * Raw per-catalog access to the requirements fetch provider.
 * @returns The four catalog resources.
 * @throws When used outside `RequirementsCatalogFetchProvider`.
 */
export function useRequirementsCatalogFetch(): RequirementsCatalogFetchContextType {
  const ctx = useContext(RequirementsCatalogFetchContext);
  if (!ctx) {
    throw new Error(
      "useRequirementsCatalogFetch must be used inside RequirementsCatalogFetchProvider"
    );
  }
  return ctx;
}
