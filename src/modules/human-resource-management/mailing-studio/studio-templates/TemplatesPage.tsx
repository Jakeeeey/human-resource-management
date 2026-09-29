"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LayoutTemplate, Loader2, RefreshCw, SearchX } from "lucide-react";

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

import { MsPager } from "./components/MsPager";
import { useMsPagination } from "./hooks/useMsPagination";
import { useMsTemplates } from "./hooks/useMsTemplates";

type TemplateSort = "name" | "key" | "updated";

const SORT_OPTIONS: readonly { readonly value: TemplateSort; readonly label: string }[] = [
    { value: "name", label: "Name A–Z" },
    { value: "key", label: "Key A–Z" },
    { value: "updated", label: "Recently updated" },
];

function isActive(value: unknown): boolean {
    return value === true || value === 1 || value === "1" || value === "true";
}

function stripMachineCode(message: string): string {
    const stripped = message.replace(/^(?:[A-Z][A-Z0-9_]*:\s*)+/, "").trim();
    return stripped === "" ? message.trim() : stripped;
}

function humaniseTemplatesError(message: string): string {
    const stripped = stripMachineCode(message);
    if (stripped !== "") return stripped;
    return "Something went wrong — please try again.";
}

function statusTone(value: unknown): string {
    if (isActive(value)) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    return "border-border bg-muted text-muted-foreground";
}

export function TemplatesPage() {
    const { data, isLoading, error, refetch } = useMsTemplates();
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState<TemplateSort>("name");
    const [retrying, setRetrying] = useState(false);

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

    const handleRetry = async (): Promise<void> => {
        setRetrying(true);
        try {
            await refetch();
        } finally {
            setRetrying(false);
        }
    };

    return (
        <section aria-label="Templates" className="flex min-h-0 flex-1 flex-col gap-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="p-3 bg-primary/10 rounded-2xl text-primary">
                        <LayoutTemplate className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold tracking-tight">Templates</h1>
                        <p className="text-sm text-muted-foreground">Reusable designs for studio sends — open one to edit.</p>
                    </div>
                </div>
                <Button aria-label="New template" className="min-h-11 md:min-h-0" size="sm" asChild>
                    <Link href="/hrm/mailing-studio/studio-templates/new">New template</Link>
                </Button>
            </header>

            <div className="flex flex-wrap items-center gap-2">
                <Input
                    aria-label="Search templates"
                    className="h-8 w-full text-xs sm:max-w-xs"
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
                    <SelectTrigger aria-label="Sort templates" className="h-8 max-w-[220px] text-xs" size="sm">
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
                <Button
                    aria-label="Refresh templates"
                    className="min-h-11 md:min-h-0"
                    disabled={isLoading}
                    size="sm"
                    variant="outline"
                    onClick={() => void refetch()}
                >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh
                </Button>
                {data ? (
                    <span
                        className="ms-auto rounded-full border bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground tabular-nums"
                        data-testid="templates-count"
                    >
                        {data.length}
                    </span>
                ) : null}
            </div>

            {isLoading && !data ? (
                <div className="flex flex-col gap-2" data-testid="templates-loading" role="status" aria-label="Loading templates">
                    {[0, 1].map((index) => (
                        <div className="flex flex-col gap-2 rounded-lg border bg-card p-3" key={index}>
                            <div className="flex items-start gap-3">
                                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                    <Skeleton className="h-4 w-1/3" />
                                    <Skeleton className="h-3 w-2/3" />
                                </div>
                                <Skeleton className="h-5 w-14 rounded-full" />
                            </div>
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    ))}
                    <span className="sr-only">Loading templates…</span>
                </div>
            ) : null}

            {error ? (
                <div
                    className="rounded-lg border border-destructive/40 bg-card p-4"
                    data-testid="templates-error"
                    role="alert"
                >
                    <p className="text-sm text-destructive">{humaniseTemplatesError(error)}</p>
                    <Button className="mt-2 min-h-11 md:min-h-0" disabled={retrying} size="sm" variant="outline" onClick={() => void handleRetry()}>
                        {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Retry
                    </Button>
                </div>
            ) : null}

            {!isLoading && !error && data && data.length === 0 ? (
                <div
                    className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-16 text-center"
                    data-testid="templates-empty"
                >
                    <LayoutTemplate aria-hidden="true" className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No templates yet.</p>
                    <Button className="min-h-11 md:min-h-0" size="sm" asChild>
                        <Link href="/hrm/mailing-studio/studio-templates/new">Create the first template</Link>
                    </Button>
                </div>
            ) : null}

            {!isLoading && !error && data && data.length > 0 && filtered.length === 0 ? (
                <div
                    className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-16 text-center"
                    data-testid="templates-no-match"
                >
                    <SearchX aria-hidden="true" className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No templates match “{search.trim()}”.</p>
                    <p className="text-xs text-muted-foreground">Try a different search.</p>
                </div>
            ) : null}

            {visible.length > 0 ? (
                <ul className="flex flex-col gap-2" data-testid="templates-list">
                    {visible.map((row) => {
                        return (
                            <li data-testid="template-row" key={String(row.id ?? row.template_key)}>
                                <Link
                                    aria-label={`Open in designer: ${row.template_name}`}
                                    className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 transition-colors duration-150 hover:border-primary/40"
                                    href={`/hrm/mailing-studio/studio-templates/${encodeURIComponent(row.template_key)}/design`}
                                >
                                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span className="truncate text-sm font-medium" title={row.template_name}>
                                            {row.template_name}
                                        </span>
                                        <span className="truncate font-mono text-xs text-muted-foreground" title={row.template_key}>
                                            {row.template_key}
                                        </span>
                                        <span className="truncate text-xs text-muted-foreground" title={row.subject}>
                                            {row.subject}
                                        </span>
                                    </div>
                                    <Badge className={statusTone(row.is_active)} variant="outline">
                                        {isActive(row.is_active) ? "Active" : "Retired"}
                                    </Badge>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
            <MsPager page={page} totalPages={totalPages} onPage={setPage} />
        </section>
    );
}
