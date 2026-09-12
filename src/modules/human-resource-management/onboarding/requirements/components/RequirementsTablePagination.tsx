"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// RequirementsTablePagination.tsx — the always-rendered footer for every
// requirements table: the `Showing X–Y of Z` range, a page-size selector, and
// the page links. Prev/Next are inert at the bounds; the active page carries
// `aria-current="page"` from the pagination primitive. Page numbers collapse to
// first/last + a window around the current page once they would overflow.

/** Selectable page sizes, smallest first. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

type PageEntry = number | "ellipsis";

/** Collapses a long page range to first/last + current-window + ellipses. */
function pageWindow(current: number, total: number): PageEntry[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }
  const pages = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);
  const window: PageEntry[] = [];
  let previous = 0;
  for (const page of pages) {
    if (page - previous > 1) window.push("ellipsis");
    window.push(page);
    previous = page;
  }
  return window;
}

interface RequirementsTablePaginationProps {
  page: number;
  pageSize: number;
  totalPages: number;
  /** Rows after filtering — the `Z` in `Showing X–Y of Z`. */
  filteredCount: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

/**
 * Renders the pagination footer for one requirements table.
 * @param props Page state, derived range, and change handlers.
 * @returns The footer markup.
 */
export function RequirementsTablePagination({
  page,
  pageSize,
  totalPages,
  filteredCount,
  rangeStart,
  rangeEnd,
  onPageChange,
  onPageSizeChange,
}: RequirementsTablePaginationProps) {
  const onFirstPage = page <= 1;
  const onLastPage = page >= totalPages;

  return (
    <div className="flex flex-col gap-3 border-t border-border/50 p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {filteredCount === 0
          ? "No rows to show"
          : `Showing ${rangeStart}–${rangeEnd} of ${filteredCount}`}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger
              size="sm"
              className="w-[90px]"
              aria-label="Rows per page"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Pagination className="mx-0 w-auto justify-start sm:justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                aria-disabled={onFirstPage || undefined}
                tabIndex={onFirstPage ? -1 : undefined}
                className={
                  onFirstPage ? "pointer-events-none opacity-50" : undefined
                }
                onClick={(event) => {
                  event.preventDefault();
                  if (!onFirstPage) onPageChange(page - 1);
                }}
              />
            </PaginationItem>

            {pageWindow(page, totalPages).map((entry, index) =>
              entry === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={entry}>
                  <PaginationLink
                    href="#"
                    isActive={entry === page}
                    aria-label={`Page ${entry} of ${totalPages}`}
                    onClick={(event) => {
                      event.preventDefault();
                      if (entry !== page) onPageChange(entry);
                    }}
                  >
                    {entry}
                  </PaginationLink>
                </PaginationItem>
              )
            )}

            <PaginationItem>
              <PaginationNext
                href="#"
                aria-disabled={onLastPage || undefined}
                tabIndex={onLastPage ? -1 : undefined}
                className={
                  onLastPage ? "pointer-events-none opacity-50" : undefined
                }
                onClick={(event) => {
                  event.preventDefault();
                  if (!onLastPage) onPageChange(page + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
