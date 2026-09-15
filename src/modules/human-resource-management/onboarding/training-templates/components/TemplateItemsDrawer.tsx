"use client";

import { useState } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useTableControls,
  type TableControlsConfig,
} from "@/modules/human-resource-management/onboarding/requirements/hooks/useTableControls";

import { useTrainingTemplatesCatalog } from "../hooks/useTrainingTemplatesCatalog";
import { runPessimisticMutation } from "../utils/pessimisticMutation";
import type {
  TemplateWithItems,
  TrainingItemRow,
} from "../types/training-templates.schema";
import { ItemFormDialog } from "./ItemFormDialog";
import { TrainingDepartmentBadge } from "./TrainingDepartmentBadge";
import { TrainingItemsTable } from "./TrainingItemsTable";
import { TrainingItemsTableFilters } from "./TrainingItemsTableFilters";

// TemplateItemsDrawer.tsx — the drill-down panel opened by a template row's
// `Manage items` action. It is a right-side shadcn Sheet (wide on desktop) that
// owns the selected template's item catalog: header (title + department scope +
// item count + `New item`), one search/required/status toolbar, the items table,
// and the item create/edit dialog. Every mutation goes through the items
// resource (pessimistic `await` + refetch) with the shared sonner Undo toast.

/**
 * Item table config: no facet accessor. The drawer's filter row
 * (`TrainingItemsTableFilters`) has no facet control, so no facet is ever wired.
 */
const ITEM_TABLE_CONFIG: TableControlsConfig<TrainingItemRow> = {
  searchText: (row) => `${row.code} ${row.title} ${row.description ?? ""}`,
  getRequiredValue: (row) => row.is_required,
  getActiveValue: (row) => row.is_active,
  sortAccessors: {
    code: (row) => row.code,
    title: (row) => row.title,
    sort_order: (row) => row.sort_order,
    is_required: (row) => row.is_required,
    is_active: (row) => row.is_active,
  },
};

interface TemplateItemsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The template whose items are shown; null renders nothing. */
  template: TemplateWithItems | null;
}

/**
 * Renders the drill-down drawer for one template's items.
 * @param props Drawer open state, change handler, and the selected template.
 * @returns The drawer, or nothing when no template is selected.
 */
export function TemplateItemsDrawer({
  open,
  onOpenChange,
  template,
}: TemplateItemsDrawerProps) {
  const { items, departments } = useTrainingTemplatesCatalog();
  const controls = useTableControls(items.rows, ITEM_TABLE_CONFIG);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TrainingItemRow | null>(null);
  const [savingItem, setSavingItem] = useState(false);

  if (template === null) {
    return null;
  }

  const countLabel = controls.isFiltered
    ? `Showing ${controls.filteredCount} of ${items.rows.length}`
    : `${items.rows.length} item${items.rows.length === 1 ? "" : "s"}`;

  const openCreateItem = () => {
    setEditingItem(null);
    setItemDialogOpen(true);
  };

  const openEditItem = (row: TrainingItemRow) => {
    setEditingItem(row);
    setItemDialogOpen(true);
  };

  const handleSaveItem = (values: Record<string, string>) => {
    const sortRaw = values.sort_order.trim();
    if (sortRaw !== "" && !/^\d+$/.test(sortRaw)) {
      toast.error("Sort order must be a whole number");
      return;
    }
    const description =
      values.description.trim() === "" ? null : values.description.trim();
    const sortOrder = sortRaw === "" ? undefined : Number(sortRaw);
    setSavingItem(true);
    const request =
      editingItem === null
        ? items.create({
            code: values.code.trim(),
            title: values.title.trim(),
            description,
            ...(sortOrder === undefined ? {} : { sort_order: sortOrder }),
          })
        : items.update(editingItem.id, {
            title: values.title.trim(),
            description,
            ...(sortOrder === undefined ? {} : { sort_order: sortOrder }),
          });
    void request
      .then(() => {
        toast.success(
          editingItem === null
            ? "Training item created"
            : "Training item updated"
        );
        setItemDialogOpen(false);
      })
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Save failed")
      )
      .finally(() => setSavingItem(false));
  };

  const handleToggleRequired = (row: TrainingItemRow) => {
    const next = !row.is_required;
    runPessimisticMutation(items.update(row.id, { is_required: next }), {
      successMessage: next ? "Marked required" : "Marked optional",
      undo: () => items.update(row.id, { is_required: !next }),
    });
  };

  const handleToggleActive = (row: TrainingItemRow) => {
    const next = !row.is_active;
    runPessimisticMutation(items.update(row.id, { is_active: next }), {
      successMessage: next ? "Topic enabled" : "Topic disabled",
      undo: () => items.update(row.id, { is_active: !next }),
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full min-w-0 flex-col gap-0 p-0 sm:max-w-3xl"
        aria-label={`Training items for ${template.title}`}
      >
        <SheetHeader className="border-b border-border/50 p-4 pr-12">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <SheetTitle
                className="truncate text-lg"
                title={template.title}
              >
                {template.title}
              </SheetTitle>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <TrainingDepartmentBadge
                  departmentIds={template.department_ids}
                  departments={departments.rows}
                />
                <span className="text-sm text-muted-foreground">
                  {countLabel}
                </span>
              </div>
              <SheetDescription className="mt-1">
                The topics new hires must complete under this template.
              </SheetDescription>
            </div>
            <Button
              onClick={openCreateItem}
              aria-label="New training item"
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              New item
            </Button>
          </div>
        </SheetHeader>

        <div className="min-w-0 flex-1 space-y-4 overflow-y-auto p-4">
          {items.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Could not load training items</AlertTitle>
              <AlertDescription>
                {items.error?.message ?? "Fetch failed"}
              </AlertDescription>
            </Alert>
          )}

          <TrainingItemsTableFilters
            search={controls.search}
            onSearchChange={controls.setSearch}
            searchPlaceholder="Search training items…"
            searchLabel="Search training items"
            required={controls.required}
            onRequiredChange={controls.setRequired}
            active={controls.active}
            onActiveChange={controls.setActive}
            showClear={controls.isFiltered}
            onClear={controls.clearFilters}
          />

          <TrainingItemsTable
            isLoading={items.isLoading}
            disabled={items.isLoading || savingItem}
            controls={controls}
            onEdit={openEditItem}
            onToggleRequired={handleToggleRequired}
            onToggleActive={handleToggleActive}
          />
        </div>

        <ItemFormDialog
          open={itemDialogOpen}
          saving={savingItem}
          row={editingItem}
          onClose={() => setItemDialogOpen(false)}
          onSave={handleSaveItem}
        />
      </SheetContent>
    </Sheet>
  );
}
