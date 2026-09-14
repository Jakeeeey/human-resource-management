"use client";

import { ListChecks, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RequirementsSortableHead } from "@/modules/human-resource-management/onboarding/requirements/components/RequirementsSortableHead";
import { RequirementsTablePagination } from "@/modules/human-resource-management/onboarding/requirements/components/RequirementsTablePagination";
import type {
  SortDirection,
  TableControls,
} from "@/modules/human-resource-management/onboarding/requirements/hooks/useTableControls";

import type {
  DepartmentOption,
  TemplateWithItems,
} from "../types/training-templates.schema";
import { TrainingDepartmentBadge } from "./TrainingDepartmentBadge";

// TemplatesTable.tsx — the dense, full-width template grid (the single catalog
// surface). It reuses the requirements presentational primitives for the
// sortable headers and the pagination footer, and it deliberately renders RAW
// `code` values in muted mono (never a humanised/title-cased label). The
// trailing `Manage items` action is the drill-down that opens the items drawer;
// `Edit` opens the template dialog. There is NO drag-and-drop reorder.

/** Template table columns: Template, Key, Department, Items, Active, Actions. */
const COLUMN_COUNT = 6;

interface TemplatesTableProps {
  /** Controls driving search/facet/status/sort/pagination over the templates. */
  controls: TableControls<TemplateWithItems>;
  departments: readonly DepartmentOption[];
  isLoading: boolean;
  disabled: boolean;
  /**
   * The template whose child items are currently loaded; that row's item count
   * is taken from `liveItemCount` so it reflects adds/removes immediately,
   * while every other row uses the count nested on the list response.
   */
  liveItemCountTemplateId: number | null;
  liveItemCount: number | null;
  onManageItems: (row: TemplateWithItems) => void;
  onEdit: (row: TemplateWithItems) => void;
  onToggleActive: (row: TemplateWithItems) => void;
}

/**
 * Renders the full-width training-template catalog table.
 * @param props Controls, department options, and per-row mutation handlers.
 * @returns The table, a skeleton while loading, or an empty state.
 */
export function TemplatesTable({
  controls,
  departments,
  isLoading,
  disabled,
  liveItemCountTemplateId,
  liveItemCount,
  onManageItems,
  onEdit,
  onToggleActive,
}: TemplatesTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (controls.totalCount === 0 && !controls.isFiltered) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No training templates yet. Add the first template.
      </p>
    );
  }

  const directionFor = (key: string): SortDirection | null =>
    controls.sort?.key === key ? controls.sort.direction : null;

  const itemCountFor = (row: TemplateWithItems): number =>
    row.id === liveItemCountTemplateId && liveItemCount !== null
      ? liveItemCount
      : row.items.length;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-card to-transparent sm:hidden"
      />
      <Table className="min-w-[720px]">
        <TableCaption className="sr-only">
          Training template catalog rows
        </TableCaption>
        <TableHeader>
          <TableRow>
            <RequirementsSortableHead
              label="Template"
              title="Training template shown to new hires"
              className="max-w-[320px]"
              direction={directionFor("title")}
              onToggle={
                controls.canSort("title")
                  ? () => controls.toggleSort("title")
                  : undefined
              }
            />
            <RequirementsSortableHead
              label="Key"
              title="Stable template code, immutable after create"
              className="max-w-[220px]"
              direction={directionFor("code")}
              onToggle={
                controls.canSort("code")
                  ? () => controls.toggleSort("code")
                  : undefined
              }
            />
            <RequirementsSortableHead
              label="Department"
              title="Department this template applies to, or every department"
              direction={null}
            />
            <RequirementsSortableHead
              label="Items"
              title="Number of training topics in this template"
              className="w-24"
              direction={null}
            />
            <RequirementsSortableHead
              label="Active"
              title="Whether this template is currently in use"
              className="w-28"
              direction={directionFor("is_active")}
              onToggle={() => controls.toggleSort("is_active")}
            />
            <TableHead scope="col" className="w-56 text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {controls.visibleRows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={COLUMN_COUNT}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No templates match your current search and filters.
              </TableCell>
            </TableRow>
          ) : (
            controls.visibleRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="max-w-[320px] truncate">
                  <span className="block max-w-full truncate" title={row.title}>
                    {row.title}
                  </span>
                </TableCell>
                <TableCell className="max-w-[220px] truncate">
                  <code
                    className="block max-w-full truncate font-mono text-xs text-muted-foreground"
                    title={row.code}
                  >
                    {row.code}
                  </code>
                </TableCell>
                <TableCell>
                  <TrainingDepartmentBadge
                    departmentId={row.department_id}
                    departments={departments}
                  />
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {itemCountFor(row)}
                </TableCell>
                <TableCell>
                  <Switch
                    size="sm"
                    checked={row.is_active}
                    disabled={disabled}
                    aria-label={`Template enabled — ${row.title}`}
                    onCheckedChange={() => onToggleActive(row)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      onClick={() => onManageItems(row)}
                      aria-label={`Manage items for ${row.title}`}
                      className="min-h-8"
                    >
                      <ListChecks
                        className="mr-1 h-4 w-4"
                        aria-hidden="true"
                      />
                      Manage items
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      onClick={() => onEdit(row)}
                      aria-label={`Edit ${row.title}`}
                      className="min-h-8"
                    >
                      <Pencil className="mr-1 h-4 w-4" aria-hidden="true" />
                      Edit
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <RequirementsTablePagination
        page={controls.page}
        pageSize={controls.pageSize}
        totalPages={controls.totalPages}
        filteredCount={controls.filteredCount}
        rangeStart={controls.rangeStart}
        rangeEnd={controls.rangeEnd}
        onPageChange={controls.setPage}
        onPageSizeChange={controls.setPageSize}
      />
    </div>
  );
}
