"use client";

import { GripVertical, Pencil } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { RequirementRow } from "./RequirementsCatalogTable";

// RequirementsCatalogRow.tsx — one sortable catalog row, extracted from
// RequirementsCatalogTable to keep that file within the module's size budget.
// The grip handle owns the drag listeners and carries a per-row accessible
// name so the row's controls are distinguishable to assistive tech.

interface RequirementsCatalogRowProps<T extends RequirementRow> {
  row: T;
  dragging: boolean;
  disabled: boolean;
  /** True when search/filter/sort makes the global ordering ambiguous. */
  reorderDisabled: boolean;
  /** Explains why the grip is inert; shown as a tooltip + native title. */
  reorderDisabledReason: string;
  /** Human label for this row, used to scope every control's accessible name. */
  rowLabel: string;
  children: React.ReactNode;
  onEdit: (row: T) => void;
  onToggleRequired: (row: T) => void;
  onToggleActive: (row: T) => void;
}

/**
 * One sortable table row with reorder grip, toggles, and edit action.
 * @param props Row, drag state, per-row accessible label, and handlers.
 * @returns The `<tr>` with the shared trailing controls.
 */
export function RequirementsCatalogRow<T extends RequirementRow>({
  row,
  dragging,
  disabled,
  reorderDisabled,
  reorderDisabledReason,
  rowLabel,
  children,
  onEdit,
  onToggleRequired,
  onToggleActive,
}: RequirementsCatalogRowProps<T>) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: row.id, disabled: reorderDisabled });

  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={dragging ? "relative z-10 bg-muted/60" : undefined}
    >
      <TableCell className="w-10">
        {reorderDisabled ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-disabled="true"
                aria-label={`Reorder ${rowLabel} unavailable`}
                title={reorderDisabledReason}
                className="flex h-8 w-6 cursor-not-allowed items-center justify-center rounded text-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <GripVertical className="h-4 w-4" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{reorderDisabledReason}</TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            aria-label={`Reorder ${rowLabel}`}
            aria-keyshortcuts="Space ArrowUp ArrowDown Escape"
            title={`Reorder ${rowLabel}`}
            className="flex h-8 w-6 cursor-grab items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </TableCell>

      {children}

      <TableCell>
        <Switch
          size="sm"
          checked={row.is_required}
          disabled={disabled}
          aria-label={`Required for new hires — ${rowLabel}`}
          onCheckedChange={() => onToggleRequired(row)}
        />
      </TableCell>
      <TableCell>
        <Switch
          size="sm"
          checked={row.is_active}
          disabled={disabled}
          aria-label={`Row enabled — ${rowLabel}`}
          onCheckedChange={() => onToggleActive(row)}
        />
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onEdit(row)}
          aria-label={`Edit ${rowLabel}`}
          className="min-h-8"
        >
          <Pencil className="mr-1 h-4 w-4" aria-hidden="true" />
          Edit
        </Button>
      </TableCell>
    </TableRow>
  );
}
