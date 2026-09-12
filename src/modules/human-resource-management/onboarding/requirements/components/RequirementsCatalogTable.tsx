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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { RequirementsReorderEntry } from "../types/requirements-catalog.schema";

// RequirementsCatalogTable.tsx — the shared table shell for every requirements
// section. This is the FIRST `@dnd-kit` usage in `src` (todo 16 of
// onboarding-requirements-config): rows are vertically sortable and a drop
// emits the pinned `{ id, sort_order }` batch the section forwards to
// `PATCH .../requirements/<catalog>/reorder`. Kept module-local — nothing here
// mirrors an existing drag implementation.

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
  className?: string;
  render: (row: T) => React.ReactNode;
}

interface RequirementsCatalogTableProps<T extends RequirementRow> {
  rows: T[];
  isLoading: boolean;
  columns: readonly CatalogColumn<T>[];
  emptyMessage: string;
  disabled: boolean;
  onEdit: (row: T) => void;
  onToggleRequired: (row: T) => void;
  onToggleActive: (row: T) => void;
  onReorder: (order: RequirementsReorderEntry[]) => void;
}

/** One sortable table row; the grip handle owns the drag listeners. */
function SortableRequirementRow({
  id,
  dragging,
  children,
}: {
  id: number;
  dragging: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={dragging ? "relative z-10 bg-muted/60" : undefined}
    >
      <TableCell className="w-10">
        <button
          type="button"
          aria-label="Drag to reorder"
          className="flex h-8 w-6 cursor-grab items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      {children}
    </TableRow>
  );
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
  disabled,
  onEdit,
  onToggleRequired,
  onToggleActive,
  onReorder,
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

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = event;
    if (over === null || active.id === over.id) return;
    const from = rows.findIndex((row) => row.id === active.id);
    const to = rows.findIndex((row) => row.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(rows, from, to);
    onReorder(
      next.map((row, index) => ({ id: row.id, sort_order: (index + 1) * 10 }))
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(event) => setDraggingId(Number(event.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              {columns.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
              <TableHead className="w-24">Required</TableHead>
              <TableHead className="w-28">Active</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <SortableContext
              items={rows.map((row) => row.id)}
              strategy={verticalListSortingStrategy}
            >
              {rows.map((row) => (
                <SortableRequirementRow
                  key={row.id}
                  id={row.id}
                  dragging={draggingId === row.id}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {column.render(row)}
                    </TableCell>
                  ))}
                  <TableCell>
                    <Switch
                      size="sm"
                      checked={row.is_required}
                      disabled={disabled}
                      aria-label="Required for new hires"
                      onCheckedChange={() => onToggleRequired(row)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        size="sm"
                        checked={row.is_active}
                        disabled={disabled}
                        aria-label="Active"
                        onCheckedChange={() => onToggleActive(row)}
                      />
                      <Badge variant={row.is_active ? "default" : "secondary"}>
                        {row.is_active ? "active" : "inactive"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      onClick={() => onEdit(row)}
                      className="min-h-8"
                    >
                      <Pencil className="mr-1 h-4 w-4" />
                      Edit
                    </Button>
                  </TableCell>
                </SortableRequirementRow>
              ))}
            </SortableContext>
          </TableBody>
        </Table>
      </div>
    </DndContext>
  );
}
