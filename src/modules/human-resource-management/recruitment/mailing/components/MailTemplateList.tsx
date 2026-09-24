"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useMailTemplates } from "../hooks/useMailTemplates";
import type { MailTemplateRow } from "../providers/mailTemplateService";
import { MailingTablePagination } from "./MailingTablePagination";
import { MailOutcomeBadge } from "./MailOutcomeBadge";

/**
 * Template list with dedicated-page create/edit navigation.
 * @returns The template table.
 */
export function MailTemplateList() {
    const router = useRouter();
    const { templates, loading, error, refresh } = useMailTemplates();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => {
        const handler = () => {
            void refresh();
        };
        window.addEventListener("mailing:refresh", handler);
        return () => window.removeEventListener("mailing:refresh", handler);
    }, [refresh]);

    const openEdit = (row: MailTemplateRow) => {
        router.push(`/hrm/mailing/templates/${String(row.id)}`);
    };

    if (loading) {
        return (
            <div className="grid gap-2">
                <Skeleton className="h-9 w-40" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-lg border border-destructive/40 bg-card p-4" role="alert">
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" className="mt-2 w-full sm:w-auto" onClick={() => void refresh()}>
                    Retry
                </Button>
            </div>
        );
    }

    const filteredCount = templates.length;
    const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
    const safePage = Math.min(page, totalPages);
    const rangeStart = filteredCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const rangeEnd = Math.min(safePage * pageSize, filteredCount);
    const pagedTemplates = templates.slice((safePage - 1) * pageSize, safePage * pageSize);

    return (
        <section aria-label="Templates" className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold">Templates</h2>
                    <span
                        aria-live="polite"
                        className="rounded-full border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground tabular-nums"
                    >
                        {filteredCount}
                    </span>
                </div>
            </div>
            {pagedTemplates.length === 0 ? (
                <div className="flex items-center justify-center rounded-lg border bg-card py-16">
                    <p className="text-sm text-muted-foreground">No templates yet. Create the first one.</p>
                </div>
            ) : (
                <ul className="flex flex-col gap-2">
                    {pagedTemplates.map((row) => (
                        <li
                            key={String(row.id)}
                            className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 transition-colors duration-150 hover:border-primary/40"
                        >
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="truncate text-sm font-medium" title={row.template_name}>
                                    {row.template_name}
                                </span>
                                <span className="truncate text-xs text-muted-foreground tabular-nums" title={`${row.template_key} · ${row.subject}`}>
                                    {row.template_key} · {row.subject}
                                </span>
                            </div>
                            <MailOutcomeBadge status={row.is_active ? "active" : "inactive"} />
                            <Button
                                aria-label={`Edit ${row.template_name}`}
                                title={`Edit ${row.template_name}`}
                                size="sm"
                                variant="outline"
                                className="w-full sm:w-auto"
                                onClick={() => openEdit(row)}
                            >
                                Edit
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
            <div className="overflow-hidden rounded-lg border bg-card">
                <MailingTablePagination
                    page={safePage}
                    pageSize={pageSize}
                    totalPages={totalPages}
                    filteredCount={filteredCount}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setPage(1);
                    }}
                />
            </div>
        </section>
    );
}
