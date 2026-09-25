"use client";

import { Button } from "@/components/ui/button";

interface MsPagerProps {
    readonly page: number;
    readonly totalPages: number;
    readonly onPage: (page: number) => void;
}

export function MsPager({ page, totalPages, onPage }: MsPagerProps) {
    if (totalPages <= 1) return null;
    return (
        <nav
            aria-label="Pagination"
            className="flex items-center justify-end gap-2"
            data-testid="ms-pager"
        >
            <span className="text-xs text-muted-foreground tabular-nums">
                Page {page} of {totalPages}
            </span>
            <Button
                aria-label="Previous page"
                className="min-h-11 md:min-h-0"
                disabled={page <= 1}
                size="sm"
                variant="outline"
                onClick={() => onPage(page - 1)}
            >
                Previous
            </Button>
            <Button
                aria-label="Next page"
                className="min-h-11 md:min-h-0"
                disabled={page >= totalPages}
                size="sm"
                variant="outline"
                onClick={() => onPage(page + 1)}
            >
                Next
            </Button>
        </nav>
    );
}
