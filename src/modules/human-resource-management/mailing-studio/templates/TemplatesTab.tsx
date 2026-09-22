"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { useMsTemplates } from "../hooks/useMsTemplates";

function toActiveLabel(value: unknown): string {
    return value === true || value === 1 || value === "1" || value === "true"
        ? "Active"
        : "Inactive";
}

/**
 * Templates tab — lists ms_templates rows from the real templates route.
 * Each row opens the designer (the live MailingStudioPage canvas); creation
 * starts at templates/new. Read + navigate only — saves happen in the
 * designer via designService.
 */
export function TemplatesTab() {
    const { data, isLoading, error, refetch } = useMsTemplates();

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
                        disabled={isLoading}
                        size="sm"
                        variant="outline"
                        onClick={() => void refetch()}
                    >
                        Refresh
                    </Button>
                    <Button aria-label="New template" size="sm" asChild>
                        <Link href="/hrm/mailing-studio/templates/new">New template</Link>
                    </Button>
                </div>
            </div>

            {isLoading && !data ? (
                <div
                    className="flex items-center justify-center py-16"
                    data-testid="templates-loading"
                    role="status"
                >
                    <span className="text-sm text-muted-foreground">Loading templates…</span>
                </div>
            ) : null}

            {error ? (
                <div
                    className="rounded-lg border border-destructive/40 bg-card p-4"
                    data-testid="templates-error"
                    role="alert"
                >
                    <p className="text-sm text-muted-foreground">{error}</p>
                    <Button className="mt-2" size="sm" variant="outline" onClick={() => void refetch()}>
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
                    <Button size="sm" asChild>
                        <Link href="/hrm/mailing-studio/templates/new">Create the first template</Link>
                    </Button>
                </div>
            ) : null}

            {data && data.length > 0 ? (
                <ul className="flex flex-col gap-2" data-testid="templates-list">
                    {data.map((row) => (
                        <li
                            className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3"
                            data-testid="template-row"
                            key={String(row.id ?? row.template_key)}
                        >
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="truncate text-sm font-medium">
                                    {row.template_name}
                                </span>
                                <span className="truncate text-xs text-muted-foreground tabular-nums">
                                    {row.template_key} · {row.subject}
                                </span>
                            </div>
                            <Badge variant="outline">{toActiveLabel(row.is_active)}</Badge>
                            <Button aria-label={`Open ${row.template_name} in designer`} size="sm" asChild>
                                <Link href="/hrm/mailing-studio">Open in designer</Link>
                            </Button>
                        </li>
                    ))}
                </ul>
            ) : null}
        </section>
    );
}
