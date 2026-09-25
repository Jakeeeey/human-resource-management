"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

interface MailingTablePaginationProps {
  page: number;
  pageSize: number;
  totalPages: number;
  filteredCount: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function MailingTablePagination({
  page,
  pageSize,
  totalPages,
  filteredCount,
  rangeStart,
  rangeEnd,
  onPageChange,
  onPageSizeChange,
}: MailingTablePaginationProps) {
  const onFirstPage = page <= 1;
  const onLastPage = page >= totalPages;

  if (totalPages <= 1) {
    return (
      <div className="flex flex-col gap-3 border-t border-border/50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
          {filteredCount === 0
            ? "Showing 0 of 0"
            : `Showing ${rangeStart}-${rangeEnd} of ${filteredCount}`}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border/50 p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
        {filteredCount === 0
          ? "Showing 0 of 0"
          : `Showing ${rangeStart}-${rangeEnd} of ${filteredCount}`}
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="max-sm:min-h-[44px]"
            disabled={onFirstPage}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap" aria-live="polite">
            {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="max-sm:min-h-[44px]"
            disabled={onLastPage}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
