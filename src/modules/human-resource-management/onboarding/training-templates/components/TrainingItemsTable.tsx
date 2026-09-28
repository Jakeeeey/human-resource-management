"use client";

import { Pencil } from "lucide-react";

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

import type { TrainingItemRow } from "../types/training-templates.schema";

// TrainingItemsTable.tsx — the drill-down table for one template's items,
// rendered inside the items drawer. It reuses the requirements presentational
// pieces (sortable head, pagination) and renders required/active Switch toggles
// plus an Edit action. `code` is shown RAW in muted mono, never humanised.
// There is NO drag-and-drop reorder — `sort_order` is edited through the item
// dialog only.

/** Item table columns: Title, Key, Order, Required, Active, Actions. */
const COLUMN_COUNT = 6;

interface TrainingItemsTableProps {
  isLoading: boolean;
  disabled: boolean;
  /** Controls driving search/sort/pagination over the item list. */
  controls: TableControls<TrainingItemRow>;
  onEdit: (row: TrainingItemRow) => void;
  onToggleRequired: (row: TrainingItemRow) => void;
  onToggleActive: (row: TrainingItemRow) => void;
}

/**
 * Renders the items of the selected template.
 * @param props Loading state, controls, and per-row mutation handlers.
 * @returns The table, a skeleton while loading, or an empty state.
 */
export function TrainingItemsTable({
  isLoading,
  disabled,
  controls,
  onEdit,
  onToggleRequired,
  onToggleActive,
}: TrainingItemsTableProps) {
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
        No training items yet. Add the first topic.
      </p>
    );
  }

  const directionFor = (key: string): SortDirection | null =>
    controls.sort?.key === key ? controls.sort.direction : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-card to-transparent sm:hidden"
      />
      <Table className="min-w-[600px]">
        <TableCaption className="sr-only">
          Training items for the selected template
        </TableCaption>
        <TableHeader>
          <TableRow>
            <RequirementsSortableHead
              label="Title"
              title="Training topic shown to new hires"
              className="max-w-[340px]"
              direction={directionFor("title")}
              onToggle={
                controls.canSort("title")
                  ? () => controls.toggleSort("title")
                  : undefined
              }
            />
            <RequirementsSortableHead
              label="Key"
              title="Stable item code, immutable after create"
              className="max-w-[220px]"
              direction={directionFor("code")}
              onToggle={
                controls.canSort("code")
                  ? () => controls.toggleSort("code")
                  : undefined
              }
            />
            <RequirementsSortableHead
              label="Order"
              title="Ascending sort position within the template"
              className="w-24"
              direction={directionFor("sort_order")}
              onToggle={
                controls.canSort("sort_order")
                  ? () => controls.toggleSort("sort_order")
                  : undefined
              }
            />
            <RequirementsSortableHead
              label="Required"
              title="Whether every new hire must complete this topic"
              className="w-24"
              direction={directionFor("is_required")}
              onToggle={() => controls.toggleSort("is_required")}
            />
            <RequirementsSortableHead
              label="Active"
              title="Whether this topic is currently in use"
              className="w-28"
              direction={directionFor("is_active")}
              onToggle={() => controls.toggleSort("is_active")}
            />
            <TableHead scope="col" className="w-24 text-right">
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
                No items match your current search and filters.
              </TableCell>
            </TableRow>
          ) : (
            controls.visibleRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="max-w-[340px] truncate">
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
                <TableCell className="tabular-nums text-muted-foreground">
                  {row.sort_order}
                </TableCell>
                <TableCell>
                  <Switch
                    size="sm"
                    checked={row.is_required}
                    disabled={disabled}
                    aria-label={`Required for new hires — ${row.title}`}
                    onCheckedChange={() => onToggleRequired(row)}
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    size="sm"
                    checked={row.is_active}
                    disabled={disabled}
                    aria-label={`Topic enabled — ${row.title}`}
                    onCheckedChange={() => onToggleActive(row)}
                  />
                </TableCell>
                <TableCell className="text-right">
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
        alwaysShowControls
      />
    </div>
  );
}
