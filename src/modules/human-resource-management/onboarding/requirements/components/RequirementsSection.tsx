"use client";

import { useState } from "react";
import { AlertCircle, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import type { CatalogResource } from "../hooks/useCatalogResource";
import type { RequirementsReorderEntry } from "../types/requirements-catalog.schema";
import {
  RequirementFieldDialog,
  type RequirementDialogField,
} from "./RequirementFieldDialog";
import {
  RequirementsCatalogTable,
  type CatalogColumn,
  type RequirementRow,
} from "./RequirementsCatalogTable";

// RequirementsSection.tsx — one catalog section: heading + toolbar, the
// sortable table, and the create/edit dialog. All four sections share this
// shell; each supplies its columns, dialog fields, and typed input mappers.
// Mutations go only through the todo-15 catalog resource (never Directus).

export interface RequirementsSectionProps<T extends RequirementRow, C, U> {
  id: string;
  title: string;
  description: string;
  emptyMessage: string;
  resource: CatalogResource<T, C, U>;
  columns: readonly CatalogColumn<T>[];
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
  description,
  emptyMessage,
  resource,
  columns,
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
        toast.success(selected === null ? `${title} row created` : `${title} row updated`);
        setDialogOpen(false);
      })
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Save failed")
      )
      .finally(() => setSaving(false));
  };

  const runToggle = (request: Promise<unknown>) => {
    void request.catch((err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Update failed")
    );
  };

  const handleReorder = (order: RequirementsReorderEntry[]) => {
    runToggle(reorder(order));
  };

  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {title}
            </h2>
            <span className="text-sm text-muted-foreground">
              {rows.length} row{rows.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => void refetch()}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            New
          </Button>
        </div>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load {title.toLowerCase()}</AlertTitle>
          <AlertDescription>
            {error?.message ?? "Fetch failed"}
          </AlertDescription>
        </Alert>
      )}

      <RequirementsCatalogTable
        rows={rows}
        isLoading={isLoading}
        columns={columns}
        emptyMessage={emptyMessage}
        disabled={saving}
        onEdit={openEdit}
        onToggleRequired={(row) => runToggle(update(row.id, toRequiredInput(row)))}
        onToggleActive={(row) => runToggle(update(row.id, toActiveInput(row)))}
        onReorder={handleReorder}
      />

      <RequirementFieldDialog
        open={dialogOpen}
        heading={selected === null ? `New ${title} row` : `Edit ${title} row`}
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
