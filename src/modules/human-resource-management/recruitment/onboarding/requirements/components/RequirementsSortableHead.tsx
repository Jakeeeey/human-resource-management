"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type { SortDirection } from "../hooks/useTableControls";

// RequirementsSortableHead.tsx — one sortable `<th>`. The header exposes its
// sort state through `aria-sort` and a directional icon, and the label is a
// button so the column can be sorted by mouse or keyboard. When the catalog
// provides no accessor for the column, the header renders as plain text.

/** Maps a sort direction to the ARIA `aria-sort` token for a header cell. */
export function ariaSortValue(
  direction: SortDirection | null
): "ascending" | "descending" | "none" {
  if (direction === "asc") return "ascending";
  if (direction === "desc") return "descending";
  return "none";
}

interface RequirementsSortableHeadProps {
  label: string;
  direction: SortDirection | null;
  /** Omit to render a non-sortable header. */
  onToggle?: () => void;
  className?: string;
  title?: string;
}

/**
 * Renders a sortable table header cell.
 * @param props Header label, current direction, toggle handler, and styling.
 * @returns The `<th>` with an icon and `aria-sort`.
 */
export function RequirementsSortableHead({
  label,
  direction,
  onToggle,
  className,
  title,
}: RequirementsSortableHeadProps) {
  const Icon =
    direction === "asc"
      ? ArrowUp
      : direction === "desc"
        ? ArrowDown
        : ArrowUpDown;
  const sortState =
    direction === "asc"
      ? ", sorted ascending"
      : direction === "desc"
        ? ", sorted descending"
        : "";

  return (
    <TableHead
      scope="col"
      className={className}
      title={title}
      aria-sort={onToggle === undefined ? undefined : ariaSortValue(direction)}
    >
      {onToggle === undefined ? (
        label
      ) : (
        <button
          type="button"
          onClick={onToggle}
          aria-label={`Sort by ${label}${sortState}`}
          className="inline-flex items-center gap-1 rounded font-medium hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {label}
          <Icon
            className={cn(
              "h-4 w-4",
              direction === null && "text-muted-foreground/60"
            )}
            aria-hidden="true"
          />
        </button>
      )}
    </TableHead>
  );
}
