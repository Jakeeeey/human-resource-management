"use client";

import { useId } from "react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export const LIST_PAGE_SIZES = [10, 25, 50, 100] as const;

export function SortSelect(props: {
    label: string;
    value: string;
    options: ReadonlyArray<{ value: string; label: string }>;
    onChange: (value: string) => void;
}): JSX.Element {
    const { label, value, options, onChange } = props;
    const triggerId = useId();
    return (
        <div className="flex items-center gap-2">
            <Label htmlFor={triggerId} className="shrink-0 text-sm text-muted-foreground">
                {label}
            </Label>
            <Select
                value={value}
                onValueChange={(next) => {
                    const match = options.find((option) => option.value === next);
                    if (match) {
                        onChange(match.value);
                    }
                }}
            >
                <SelectTrigger id={triggerId} className="h-10 min-w-0 flex-1 sm:flex-none">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

export function ListPager(props: {
    page: number;
    pageCount: number;
    rangeStart: number;
    rangeEnd: number;
    total: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
}): JSX.Element {
    const { page, pageCount, rangeStart, rangeEnd, total, pageSize, onPageChange, onPageSizeChange } = props;
    const sizeId = useId();
    return (
        <nav aria-label="Pagination" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground" aria-live="polite">
                Showing {rangeStart}–{rangeEnd} of {total}
            </p>
            <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor={sizeId} className="shrink-0 text-sm text-muted-foreground">
                    Rows per page
                </Label>
                <Select
                    value={String(pageSize)}
                    onValueChange={(next) => {
                        const parsed = Number.parseInt(next, 10);
                        const match = LIST_PAGE_SIZES.find((size) => size === parsed);
                        if (match !== undefined) {
                            onPageSizeChange(match);
                        }
                    }}
                >
                    <SelectTrigger id={sizeId} className="h-9 w-[84px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                        {LIST_PAGE_SIZES.map((size) => (
                            <SelectItem key={size} value={String(size)}>
                                {size}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
                    Previous
                </Button>
                <span className="text-sm text-muted-foreground" aria-live="polite">
                    Page {page + 1} of {pageCount}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pageCount - 1}
                    onClick={() => onPageChange(page + 1)}
                >
                    Next
                </Button>
            </div>
        </nav>
    );
}
