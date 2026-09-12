"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { RequirementsReorderEntry } from "../types/requirements-catalog.schema";
import type { SortDirection, TableControls } from "../hooks/useTableControls";
import { RequirementsCatalogRow } from "./RequirementsCatalogRow";
import { RequirementsSortableHead } from "./RequirementsSortableHead";
import { RequirementsTablePagination } from "./RequirementsTablePagination";

// RequirementsCatalogTable.tsx — the shared table shell for every requirements
// section. Rows are vertically sortable and a drop emits the pinned
// `{ id, sort_order }` batch the section forwards to
// `PATCH .../requirements/<catalog>/reorder`. Keyboard reordering is provided
// by the configured `KeyboardSensor` + `sortableKeyboardCoordinates` (Space/
// Enter to pick up, arrows to move, Escape to cancel). Headers sort through the
// shared `TableControls`; the pagination footer always renders, and reorder is
// gated to the untouched default `sort_order` view so a drag always maps to a
// globally correct index. The per-row markup lives in RequirementsCatalogRow.

/** Tooltip explaining why a row's grip is inert while the view is narrowed. */
export const REORDER_DISABLED_REASON =
  "Clear search, filters, and sorting to reorder";

/** Minimum a row needs for the table's toggles + sortable identity. */
export interface RequirementRow {
  id: number;
  is_required: boolean;
  is_active: boolean;
}

/** One catalog-specific column; the table owns the shared trailing actions. */
export interface CatalogColumn<T> {
  key: string;
  header: string;
  /** Optional explanation surfaced as the header's native tooltip. */
  headerTitle?: string;
  className?: string;
  render: (row: T) => React.ReactNode;
}

interface RequirementsCatalogTableProps<T extends RequirementRow> {
  /** The full catalog list in fetched `sort_order` — the reorder source. */
  rows: readonly T[];
  isLoading: boolean;
  columns: readonly CatalogColumn<T>[];
  emptyMessage: string;
  caption: string;
  disabled: boolean;
  /** Human label per row, used to scope every control's accessible name. */
  rowLabel: (row: T) => string;
  onEdit: (row: T) => void;
  onToggleRequired: (row: T) => void;
  onToggleActive: (row: T) => void;
  onReorder: (order: RequirementsReorderEntry[]) => void;
  controls: TableControls<T>;
}

/**
 * Sortable catalog table with required/active toggles and an edit action.
 * @param props Rows, columns, per-row mutation handlers, reorder emitter.
 * @returns The table, a skeleton while loading, or an empty state.
 */
export function RequirementsCatalogTable<T extends RequirementRow>({
  rows,
  isLoading,
  columns,
  emptyMessage,
  caption,
  disabled,
  rowLabel,
  onEdit,
  onToggleRequired,
  onToggleActive,
  onReorder,
  controls,
}: RequirementsCatalogTableProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const [draggingId, setDraggingId] = useState<number | null>(null);

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
        {emptyMessage}
      </p>
    );
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingId(null);
    if (!controls.canReorder) return;
    const { active, over } = event;
    if (over === null || active.id === over.id) return;
    // `from`/`to` come from the FULL ordered list, never the page slice, so a
    // page-1 drag still emits a globally correct `sort_order`.
    const from = rows.findIndex((row) => row.id === active.id);
    const to = rows.findIndex((row) => row.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove([...rows], from, to);
    onReorder(
      next.map((row, index) => ({ id: row.id, sort_order: (index + 1) * 10 }))
    );
  };

  const directionFor = (key: string): SortDirection | null =>
    controls.sort?.key === key ? controls.sort.direction : null;

  const visibleRows = controls.visibleRows;
  const columnCount = columns.length + 4;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(event) => setDraggingId(Number(event.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-card to-transparent sm:hidden"
        />
        <Table className="min-w-[720px]">
          <TableCaption className="sr-only">{caption}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="w-10">
                <span className="sr-only">Reorder</span>
              </TableHead>
              {columns.map((column) => (
                <RequirementsSortableHead
                  key={column.key}
                  label={column.header}
                  title={column.headerTitle}
                  className={column.className}
                  direction={directionFor(column.key)}
                  onToggle={
                    controls.canSort(column.key)
                      ? () => controls.toggleSort(column.key)
                      : undefined
                  }
                />
              ))}
              <RequirementsSortableHead
                label="Required"
                title="Whether every new hire must complete this row"
                className="w-24"
                direction={directionFor("is_required")}
                onToggle={() => controls.toggleSort("is_required")}
              />
              <RequirementsSortableHead
                label="Active"
                title="Whether this row is currently in use"
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
            <SortableContext
              items={visibleRows.map((row) => row.id)}
              strategy={verticalListSortingStrategy}
            >
              {visibleRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columnCount}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No rows match your current search and filters.
                  </TableCell>
                </TableRow>
              ) : (
                visibleRows.map((row) => (
                  <RequirementsCatalogRow
                    key={row.id}
                    row={row}
                    dragging={draggingId === row.id}
                    disabled={disabled}
                    reorderDisabled={!controls.canReorder}
                    reorderDisabledReason={REORDER_DISABLED_REASON}
                    rowLabel={rowLabel(row)}
                    onEdit={onEdit}
                    onToggleRequired={onToggleRequired}
                    onToggleActive={onToggleActive}
                  >
                    {columns.map((column) => (
                      <TableCell key={column.key} className={column.className}>
                        {column.render(row)}
                      </TableCell>
                    ))}
                  </RequirementsCatalogRow>
                ))
              )}
            </SortableContext>
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
    </DndContext>
  );
}
