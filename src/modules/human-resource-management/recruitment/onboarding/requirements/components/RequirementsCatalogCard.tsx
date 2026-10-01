"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

import type {
  CatalogColumn,
  RequirementRow,
} from "./RequirementsCatalogTable";

// RequirementsCatalogCard.tsx — the sub-`md` rendering of one catalog row.
// The 720px table cannot fit a phone, so below `md` each row becomes a card:
// every column is labelled and free to wrap (no truncation), and Required /
// Active / Edit stay on-screen instead of living past a hidden h-scroll edge.
// Reorder keeps the same `useSortable` grip contract as the table row.

interface RequirementsCatalogCardProps<T extends RequirementRow> {
  row: T;
  columns: readonly CatalogColumn<T>[];
  dragging: boolean;
  disabled: boolean;
  reorderDisabled: boolean;
  reorderDisabledReason: string;
  rowLabel: string;
  onEdit: (row: T) => void;
  onToggleRequired: (row: T) => void;
  onToggleActive: (row: T) => void;
}

export function RequirementsCatalogCard<T extends RequirementRow>({
  row,
  columns,
  dragging,
  disabled,
  reorderDisabled,
  reorderDisabledReason,
  rowLabel,
  onEdit,
  onToggleRequired,
  onToggleActive,
}: RequirementsCatalogCardProps<T>) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: row.id, disabled: reorderDisabled });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`space-y-3 p-4 ${dragging ? "bg-muted/60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <dl className="min-w-0 flex-1 space-y-1">
          {columns.map((column) => (
            <div key={column.key} className="flex min-w-0 items-baseline gap-2">
              <dt className="shrink-0 text-xs text-muted-foreground">
                {column.header}
              </dt>
              <dd className="min-w-0 flex-1 text-sm">{column.render(row)}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          aria-label={
            reorderDisabled
              ? `Reorder ${rowLabel} unavailable`
              : `Reorder ${rowLabel}`
          }
          aria-keyshortcuts="Space ArrowUp ArrowDown Escape"
          title={reorderDisabled ? reorderDisabledReason : `Reorder ${rowLabel}`}
          disabled={reorderDisabled}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded ${
            reorderDisabled
              ? "cursor-not-allowed text-muted-foreground/40"
              : "cursor-grab text-muted-foreground"
          }`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Required
          <Switch
            size="sm"
            checked={row.is_required}
            disabled={disabled}
            aria-label={`Required for new hires — ${rowLabel}`}
            onCheckedChange={() => onToggleRequired(row)}
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Active
          <Switch
            size="sm"
            checked={row.is_active}
            disabled={disabled}
            aria-label={`Row enabled — ${rowLabel}`}
            onCheckedChange={() => onToggleActive(row)}
          />
        </label>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="ml-auto min-h-9"
          aria-label={`Edit ${rowLabel}`}
          onClick={() => onEdit(row)}
        >
          <Pencil className="mr-1 h-4 w-4" />
          Edit
        </Button>
      </div>
    </li>
  );
}
