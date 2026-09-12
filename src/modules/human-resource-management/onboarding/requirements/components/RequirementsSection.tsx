"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import type { CatalogResource } from "../hooks/useCatalogResource";
import {
  useTableControls,
  type TableControlsConfig,
} from "../hooks/useTableControls";
import type { RequirementsReorderEntry } from "../types/requirements-catalog.schema";
import { RequirementFieldDialog, type RequirementDialogField } from "./RequirementFieldDialog";
import type { CatalogColumn, RequirementRow } from "./RequirementsCatalogTable";
import { RequirementsCatalogTable } from "./RequirementsCatalogTable";
import {
  RequirementsTableFilters,
  type FacetConfig,
} from "./RequirementsTableFilters";
import { RequirementsSectionHeader } from "./RequirementsSectionHeader";

// RequirementsSection.tsx — one catalog section: heading + toolbar, the
// filterable/sortable/paginated table, and the create/edit dialog. All four
// sections share this shell; each supplies its columns, dialog fields, table
// controls config, and typed input mappers. Mutations go only through the
// todo-15 catalog resource (never Directus).

/** Per-catalog search/facet/sort accessors plus the search placeholder. */
export interface RequirementsTableConfig<T> extends TableControlsConfig<T> {
  searchPlaceholder: string;
  facet?: FacetConfig;
}

export interface RequirementsSectionProps<T extends RequirementRow, C, U> {
  id: string;
  title: string;
  /** Singular noun for dialog copy, e.g. "document". */
  entityLabel: string;
  description: string;
  emptyMessage: string;
  resource: CatalogResource<T, C, U>;
  columns: readonly CatalogColumn<T>[];
  /** Human label per row, used to scope every control's accessible name. */
  rowLabel: (row: T) => string;
  /** Search/facet/sort accessors driving this section's table controls. */
  tableConfig: RequirementsTableConfig<T>;
  dialogFields: readonly RequirementDialogField[];
  createInitial: Record<string, string>;
  rowToInitial: (row: T) => Record<string, string>;
  toCreateInput: (values: Record<string, string>) => C;
  toUpdateInput: (values: Record<string, string>, row: T) => U;
  toRequiredInput: (row: T) => U;
  toActiveInput: (row: T) => U;
}

/**
 * Renders one requirements catalog with create/edit/toggle/reorder wiring.
 * @param props Section copy, catalog resource, columns, and input mappers.
 * @returns The section markup.
 */
export function RequirementsSection<T extends RequirementRow, C, U>({
  id,
  title,
  entityLabel,
  description,
  emptyMessage,
  resource,
  columns,
  rowLabel,
  tableConfig,
  dialogFields,
  createInitial,
  rowToInitial,
  toCreateInput,
  toUpdateInput,
  toRequiredInput,
  toActiveInput,
}: RequirementsSectionProps<T, C, U>) {
  const { rows, isLoading, isError, error, refetch, create, update, reorder } =
    resource;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);

  const controls = useTableControls(rows, tableConfig);
  const countLabel = controls.isFiltered
    ? `Showing ${controls.filteredCount} of ${rows.length}`
    : `${rows.length} row${rows.length === 1 ? "" : "s"}`;

  const openCreate = () => {
    setSelected(null);
    setDialogOpen(true);
  };

  const openEdit = (row: T) => {
    setSelected(row);
    setDialogOpen(true);
  };

  const handleSave = (values: Record<string, string>) => {
    setSaving(true);
    const request =
      selected === null
        ? create(toCreateInput(values))
        : update(selected.id, toUpdateInput(values, selected));
    void request
      .then(() => {
        toast.success(
          selected === null ? `${title} row created` : `${title} row updated`
        );
        setDialogOpen(false);
      })
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Save failed")
      )
      .finally(() => setSaving(false));
  };

  const runToggle = (
    request: Promise<unknown>,
    undo?: () => Promise<unknown>
  ) => {
    void request
      .then(() => {
        if (undo === undefined) return;
        toast.success("Row updated", {
          action: { label: "Undo", onClick: () => runToggle(undo()) },
        });
      })
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Update failed")
      );
  };

  const handleReorder = (order: RequirementsReorderEntry[]) => {
    runToggle(reorder(order));
  };

  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <RequirementsSectionHeader
        title={title}
        description={description}
        countLabel={countLabel}
        entityLabel={entityLabel}
        isLoading={isLoading}
        onRefresh={() => void refetch()}
        onCreate={openCreate}
      />

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load {title.toLowerCase()}</AlertTitle>
          <AlertDescription>
            {error?.message ?? "Fetch failed"}
          </AlertDescription>
        </Alert>
      )}

      <RequirementsTableFilters
        search={controls.search}
        onSearchChange={controls.setSearch}
        searchPlaceholder={tableConfig.searchPlaceholder}
        searchLabel={`Search ${title.toLowerCase()}`}
        facet={tableConfig.facet}
        facetValue={controls.facet}
        onFacetChange={controls.setFacet}
        required={controls.required}
        onRequiredChange={controls.setRequired}
        active={controls.active}
        onActiveChange={controls.setActive}
        showClear={controls.isFiltered}
        onClear={controls.clearFilters}
      />

      <RequirementsCatalogTable
        rows={rows}
        isLoading={isLoading}
        columns={columns}
        emptyMessage={emptyMessage}
        caption={`${title} requirement rows`}
        disabled={saving}
        rowLabel={rowLabel}
        onEdit={openEdit}
        onToggleRequired={(row) =>
          runToggle(update(row.id, toRequiredInput(row)), () =>
            update(row.id, toRequiredInput({ ...row, is_required: !row.is_required }))
          )
        }
        onToggleActive={(row) =>
          runToggle(update(row.id, toActiveInput(row)), () =>
            update(row.id, toActiveInput({ ...row, is_active: !row.is_active }))
          )
        }
        onReorder={handleReorder}
        controls={controls}
      />

      <RequirementFieldDialog
        open={dialogOpen}
        heading={selected === null ? `New ${entityLabel}` : `Edit ${entityLabel}`}
        description={
          selected === null
            ? `Add a new ${entityLabel} to this catalog.`
            : `Update this ${entityLabel}. Required and Active are toggled directly in the table.`
        }
        isEdit={selected !== null}
        saving={saving}
        fields={dialogFields}
        initial={selected === null ? createInitial : rowToInitial(selected)}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
    </section>
  );
}
