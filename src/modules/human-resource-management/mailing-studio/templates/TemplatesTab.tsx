"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { MsPager } from "../components/MsPager";
import { useMsPagination } from "../hooks/useMsPagination";
import { useMsTemplates } from "../hooks/useMsTemplates";

type TemplateSort = "name" | "key" | "updated";

const SORT_OPTIONS: readonly { readonly value: TemplateSort; readonly label: string }[] = [
    { value: "name", label: "Name A–Z" },
    { value: "key", label: "Key A–Z" },
    { value: "updated", label: "Recently updated" },
];

function isActive(value: unknown): boolean {
    return value === true || value === 1 || value === "1" || value === "true";
}

/**
 * Templates tab — lists ms_templates rows from the real templates route.
 * Each row deep-links the designer with its template_key (?key=) so a second
 * template can never collide with the first; creation starts at
 * templates/new. Read + navigate only — saves happen in the designer via
 * designService. Search + sort + pagination per QA §11.
 */
export function TemplatesTab() {
    const { data, isLoading, error, refetch } = useMsTemplates();
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState<TemplateSort>("name");

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        const rows = (data ?? []).filter((row) => {
            if (!query) return true;
            return (
                row.template_name.toLowerCase().includes(query) ||
                row.template_key.toLowerCase().includes(query) ||
                row.subject.toLowerCase().includes(query)
            );
        });
        return [...rows].sort((a, b) => {
            if (sort === "key") return a.template_key.localeCompare(b.template_key);
            if (sort === "updated") {
                return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
            }
            return a.template_name.localeCompare(b.template_name);
        });
    }, [data, search, sort]);

    const { page, totalPages, pageItems, setPage, resetPage } = useMsPagination(filtered.length);
    const visible = pageItems(filtered);

    return (
        <section aria-label="Templates" className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold">Templates</h2>
                    {data ? (
                        <span
                            className="rounded-full border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground tabular-nums"
                            data-testid="templates-count"
                        >
                            {data.length}
                        </span>
                    ) : null}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        aria-label="Refresh templates"
                        className="min-h-11 md:min-h-0"
                        disabled={isLoading}
                        size="sm"
                        variant="outline"
                        onClick={() => void refetch()}
                    >
                        Refresh
                    </Button>
                    <Button aria-label="New template" className="min-h-11 md:min-h-0" size="sm" asChild>
                        <Link href="/hrm/mailing-studio/templates/new">New template</Link>
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Input
                    aria-label="Search templates"
                    className="h-8 max-w-xs text-xs"
                    placeholder="Search name, key, or subject…"
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        resetPage();
                    }}
                />
                <Select
                    value={sort}
                    onValueChange={(next) => {
                        setSort(next as TemplateSort);
                        resetPage();
                    }}
                >
                    <SelectTrigger aria-label="Sort templates" className="h-8 max-w-[180px] text-xs" size="sm">
                        <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                        {SORT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {isLoading && !data ? (
                <div className="flex flex-col gap-2" data-testid="templates-loading" role="status" aria-label="Loading templates">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <span className="sr-only">Loading templates…</span>
                </div>
            ) : null}

            {error ? (
                <div
                    className="rounded-lg border border-destructive/40 bg-card p-4"
                    data-testid="templates-error"
                    role="alert"
                >
                    <p className="text-sm text-destructive">{error}</p>
                    <Button className="mt-2 min-h-11 md:min-h-0" size="sm" variant="outline" onClick={() => void refetch()}>
                        Retry
                    </Button>
                </div>
            ) : null}

            {!isLoading && !error && data && data.length === 0 ? (
                <div
                    className="flex flex-col items-center gap-3 rounded-lg border bg-card py-16 text-center"
                    data-testid="templates-empty"
                >
                    <p className="text-sm text-muted-foreground">No templates yet.</p>
                    <Button className="min-h-11 md:min-h-0" size="sm" asChild>
                        <Link href="/hrm/mailing-studio/templates/new">Create the first template</Link>
                    </Button>
                </div>
            ) : null}

            {!isLoading && !error && data && data.length > 0 && filtered.length === 0 ? (
                <div
                    className="flex flex-col items-center gap-3 rounded-lg border bg-card py-16 text-center"
                    data-testid="templates-no-match"
                >
                    <p className="text-sm text-muted-foreground">No templates match “{search.trim()}”.</p>
                    <p className="text-xs text-muted-foreground">Try a different search.</p>
                </div>
            ) : null}

            {visible.length > 0 ? (
                <ul className="flex flex-col gap-2" data-testid="templates-list">
                    {visible.map((row) => {
                        const ref = row.id ?? row.template_key;
                        return (
                            <li
                                className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3"
                                data-testid="template-row"
                                key={String(row.id ?? row.template_key)}
                            >
                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="truncate text-sm font-medium" title={row.template_name}>
                                        {row.template_name}
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground tabular-nums" title={`${row.template_key} · ${row.subject}`}>
                                        {row.template_key} · {row.subject}
                                    </span>
                                </div>
                                <Badge variant={isActive(row.is_active) ? "default" : "outline"}>
                                    {isActive(row.is_active) ? "Active" : "Retired"}
                                </Badge>
                                <Button aria-label={`Open in designer: ${row.template_name}`} className="min-h-11 md:min-h-0" size="sm" asChild>
                                    <Link href={`/hrm/mailing-studio?key=${encodeURIComponent(row.template_key)}`}>
                                        Open in designer
                                    </Link>
                                </Button>
                                <Button aria-label={`Details for ${row.template_name}`} className="min-h-11 md:min-h-0" size="sm" variant="outline" asChild>
                                    <Link href={`/hrm/mailing-studio/templates/${encodeURIComponent(String(ref))}`}>
                                        Details
                                    </Link>
                                </Button>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
            <MsPager page={page} totalPages={totalPages} onPage={setPage} />
        </section>
    );
}
