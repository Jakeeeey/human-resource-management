"use client";

import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export const MS_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

interface MsPagerProps {
    readonly page: number;
    readonly pageSize: number;
    readonly totalPages: number;
    readonly total: number;
    readonly rangeStart: number;
    readonly rangeEnd: number;
    readonly onPage: (page: number) => void;
    readonly onPageSize: (size: number) => void;
}

export function MsPager({
    page,
    pageSize,
    totalPages,
    total,
    rangeStart,
    rangeEnd,
    onPage,
    onPageSize,
}: MsPagerProps) {
    return (
        <div
            className="flex flex-col gap-3 border-t border-border/50 p-3 sm:flex-row sm:items-center sm:justify-between"
            data-testid="ms-pager"
        >
            <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
                {total === 0
                    ? "Showing 0 of 0"
                    : `Showing ${rangeStart}-${rangeEnd} of ${total}`}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows per page</span>
                    <Select
                        value={String(pageSize)}
                        onValueChange={(value) => onPageSize(Number(value))}
                    >
                        <SelectTrigger aria-label="Rows per page" className="w-[90px]" size="sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {MS_PAGE_SIZE_OPTIONS.map((size) => (
                                <SelectItem key={size} value={String(size)}>
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        aria-label="Previous page"
                        className="max-sm:min-h-[44px]"
                        disabled={page <= 1}
                        size="sm"
                        variant="outline"
                        onClick={() => onPage(page - 1)}
                    >
                        Previous
                    </Button>
                    <span aria-live="polite" className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
                        {page} of {totalPages}
                    </span>
                    <Button
                        aria-label="Next page"
                        className="max-sm:min-h-[44px]"
                        disabled={page >= totalPages}
                        size="sm"
                        variant="outline"
                        onClick={() => onPage(page + 1)}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}
