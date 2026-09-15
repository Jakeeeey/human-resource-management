"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MultiCombobox,
  type MultiComboboxOption,
} from "./MultiCombobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequirementsSectionHeader } from "@/modules/human-resource-management/onboarding/requirements/components/RequirementsSectionHeader";
import {
  useTableControls,
  type ActiveFilter,
  type TableControlsConfig,
} from "@/modules/human-resource-management/onboarding/requirements/hooks/useTableControls";

import { useTrainingTemplatesCatalog } from "../hooks/useTrainingTemplatesCatalog";
import { runPessimisticMutation } from "../utils/pessimisticMutation";
import {
  GLOBAL_DEPARTMENT_VALUE,
  type CreateTrainingTemplateInput,
  type TemplateWithItems,
  type TrainingTemplateRow,
} from "../types/training-templates.schema";
import {
  TemplateFormDialog,
  type TrainingTemplateFormValues,
} from "./TemplateFormDialog";
import { TemplateItemsDrawer } from "./TemplateItemsDrawer";
import { TemplatesTable } from "./TemplatesTable";

// TrainingTemplatesWorkspace.tsx — the single catalog surface for training
// templates: one section header (Refresh + New), one toolbar (search +
// department + status), one full-width dense table, one pagination footer, and
// the items drill-down drawer. It replaces the rejected master-detail split.
// The template's department is a multiselect toolbar filter; `is_active` is the
// status.
// Every mutation is pessimistic (resource awaits + refetches) with a sonner
// Undo toast, and the child items live behind `Manage items`.

const TEMPLATE_TABLE_CONFIG: TableControlsConfig<TemplateWithItems> = {
  searchText: (row) => `${row.code} ${row.title} ${row.description ?? ""}`,
  // Department is a multiselect applied to the row list before the hook, so this
  // config intentionally has no single-select facet accessor.
  // Templates have no required flag; the required facet is unused on this side.
  getRequiredValue: () => false,
  getActiveValue: (row) => row.is_active,
  sortAccessors: {
    code: (row) => row.code,
    title: (row) => row.title,
    is_active: (row) => row.is_active,
  },
};

/**
 * True for an empty selection, when the row's effective set contains any
 * selected department, or when a GLOBAL row (empty set) is matched by the
 * GLOBAL filter token.
 */
function matchesDepartmentFilters(
  row: TemplateWithItems,
  selected: readonly string[]
): boolean {
  if (selected.length === 0) return true;
  const departmentIds = row.department_ids ?? [];
  if (departmentIds.length === 0) {
    return selected.includes(GLOBAL_DEPARTMENT_VALUE);
  }
  return departmentIds.some((id) => selected.includes(String(id)));
}

/**
 * Renders the training-templates catalog and its item drill-down drawer.
 * @returns The section header, filter toolbar, dense table, and drawer.
 */
export function TrainingTemplatesWorkspace() {
  const { templates, items, departments, selectedTemplate, selectTemplate } =
    useTrainingTemplatesCatalog();

  const [departmentFilters, setDepartmentFilters] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<TrainingTemplateRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const departmentFilteredRows = useMemo(
    () =>
      templates.rows.filter((row) =>
        matchesDepartmentFilters(row, departmentFilters)
      ),
    [templates.rows, departmentFilters]
  );
  const controls = useTableControls(
    departmentFilteredRows,
    TEMPLATE_TABLE_CONFIG
  );

  const isFiltered = controls.isFiltered || departmentFilters.length > 0;
  const countLabel = isFiltered
    ? `Showing ${controls.filteredCount} of ${templates.rows.length}`
    : `${templates.rows.length} row${templates.rows.length === 1 ? "" : "s"}`;

  const departmentOptions: MultiComboboxOption[] = [
    { value: GLOBAL_DEPARTMENT_VALUE, label: "All Departments" },
    ...departments.rows.map((department) => ({
      value: String(department.department_id),
      label: department.department_name,
    })),
  ];

  const handleDepartmentChange = (values: string[]) => {
    setDepartmentFilters(values);
    controls.setPage(1);
  };

  const handleClearFilters = () => {
    controls.clearFilters();
    setDepartmentFilters([]);
  };

  const openCreate = () => {
    setEditingTemplate(null);
    setDialogOpen(true);
  };

  const openEdit = (row: TrainingTemplateRow) => {
    setEditingTemplate(row);
    setDialogOpen(true);
  };

  const handleSaveTemplate = (values: TrainingTemplateFormValues) => {
    const description = values.description === "" ? null : values.description;
    setSaving(true);
    const request =
      editingTemplate === null
        ? templates.create({
            code: values.code,
            title: values.title,
            description,
            department_ids: values.departmentIds,
          } satisfies CreateTrainingTemplateInput)
        : templates.update(editingTemplate.id, {
            title: values.title,
            description,
            department_ids: values.departmentIds,
          });
    void request
      .then(() => {
        toast.success(
          editingTemplate === null
            ? "Training template created"
            : "Training template updated"
        );
        setDialogOpen(false);
      })
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Save failed")
      )
      .finally(() => setSaving(false));
  };

  const handleToggleActive = (row: TemplateWithItems) => {
    const next = !row.is_active;
    runPessimisticMutation(templates.update(row.id, { is_active: next }), {
      successMessage: next ? "Template activated" : "Template deactivated",
      undo: () => templates.update(row.id, { is_active: !next }),
    });
  };

  const handleManageItems = (row: TemplateWithItems) => {
    selectTemplate(row.id);
    setDrawerOpen(true);
  };

  return (
    <section className="min-w-0 space-y-4">
      <RequirementsSectionHeader
        title="Templates"
        description="Templates can cover one or more departments, or apply to all departments."
        countLabel={countLabel}
        entityLabel="training template"
        isLoading={templates.isLoading}
        onRefresh={() => void templates.refetch()}
        onCreate={openCreate}
      />

      {templates.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load training templates</AlertTitle>
          <AlertDescription>
            {templates.error?.message ?? "Fetch failed"}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={controls.search}
            onChange={(event) => controls.setSearch(event.target.value)}
            placeholder="Search templates…"
            aria-label="Search training templates"
            className="pl-8"
          />
        </div>

        <MultiCombobox
          options={departmentOptions}
          values={departmentFilters}
          onValuesChange={handleDepartmentChange}
          placeholder="Filter by department"
          searchPlaceholder="Search departments…"
          emptyMessage="No departments found."
          className="w-full sm:w-[240px]"
        />

        <Select
          value={controls.active}
          onValueChange={(value) => controls.setActive(value as ActiveFilter)}
        >
          <SelectTrigger
            size="sm"
            className="w-full sm:w-[150px]"
            aria-label="Filter by status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            aria-label="Clear template search and filters"
            className="w-full sm:w-auto"
          >
            <X className="mr-1 h-4 w-4" aria-hidden="true" />
            Clear filters
          </Button>
        )}
      </div>

      <TemplatesTable
        controls={{ ...controls, isFiltered }}
        departments={departments.rows}
        isLoading={templates.isLoading}
        disabled={templates.isLoading}
        liveItemCountTemplateId={selectedTemplate?.id ?? null}
        liveItemCount={items.isLoading ? null : items.rows.length}
        onManageItems={handleManageItems}
        onEdit={openEdit}
        onToggleActive={handleToggleActive}
      />

      <TemplateFormDialog
        open={dialogOpen}
        saving={saving}
        row={editingTemplate}
        onClose={() => setDialogOpen(false)}
        onSave={handleSaveTemplate}
      />

      <TemplateItemsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        template={selectedTemplate}
      />
    </section>
  );
}
