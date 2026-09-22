"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useMsOutbox } from "../hooks/useMsOutbox";
import { useMsOutboxRow } from "../hooks/useMsOutboxRow";

const STATUS_FILTERS = ["all", "queued", "sent", "failed", "skipped", "dry_run"] as const;

function statusVariant(status: unknown): "default" | "secondary" | "destructive" | "outline" {
    if (status === "sent") return "default";
    if (status === "failed") return "destructive";
    if (status === "queued") return "secondary";
    return "outline";
}

/**
 * Outbox tab — read-only viewer over the real outbox routes. Recipients
 * arrive masked from the server; there is deliberately NO resend action on
 * this path (D17 — no resend endpoint exists), so none is rendered.
 */
export function OutboxTab() {
    const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
    const [selectedId, setSelectedId] = useState<string | number | null>(null);
    const { data, isLoading, error, refetch } = useMsOutbox(
        filter === "all" ? undefined : filter,
    );
    const detail = useMsOutboxRow(selectedId);

    return (
        <section aria-label="Outbox" className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Status filter">
                    {STATUS_FILTERS.map((status) => (
                        <button
                            aria-pressed={filter === status}
                            className={cn(
                                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150",
                                filter === status
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                            )}
                            data-testid={`outbox-filter-${status}`}
                            key={status}
                            type="button"
                            onClick={() => {
                                setFilter(status);
                                setSelectedId(null);
                            }}
                        >
                            {status}
                        </button>
                    ))}
                </div>
                <Button
                    aria-label="Refresh outbox"
                    disabled={isLoading}
                    size="sm"
                    variant="outline"
                    onClick={() => void refetch()}
                >
                    Refresh
                </Button>
            </div>

            {isLoading && !data ? (
                <div
                    className="flex items-center justify-center py-16"
                    data-testid="outbox-loading"
                    role="status"
                >
                    <span className="text-sm text-muted-foreground">Loading outbox…</span>
                </div>
            ) : null}

            {error ? (
                <div
                    className="rounded-lg border border-destructive/40 bg-card p-4"
                    data-testid="outbox-error"
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
                    className="flex items-center justify-center rounded-lg border bg-card py-16"
                    data-testid="outbox-empty"
                >
                    <p className="text-sm text-muted-foreground">No outbox entries for this filter.</p>
                </div>
            ) : null}

            {data && data.length > 0 ? (
                <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
                    <ul className="flex flex-col gap-2 overflow-y-auto" data-testid="outbox-list">
                        {data.map((row) => (
                            <li key={String(row.id ?? row.idempotency_key)}>
                                <button
                                    aria-pressed={selectedId === row.id}
                                    className={cn(
                                        "flex w-full flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-left transition-colors duration-150 hover:border-primary/40",
                                        selectedId === row.id ? "border-primary/60" : undefined,
                                    )}
                                    data-testid="outbox-row"
                                    type="button"
                                    onClick={() => setSelectedId(
                                        typeof row.id === "string" || typeof row.id === "number"
                                            ? row.id
                                            : null,
                                    )}
                                >
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium tabular-nums">
                                        {row.to_email}
                                    </span>
                                    <Badge variant={statusVariant(row.status)}>
                                        {String(row.status ?? "unknown")}
                                    </Badge>
                                </button>
                            </li>
                        ))}
                    </ul>

                    <div
                        className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-lg border bg-card p-4"
                        data-testid="outbox-detail"
                    >
                        {selectedId === null ? (
                            <p className="text-sm text-muted-foreground">
                                Select an entry to inspect its masked delivery record.
                            </p>
                        ) : detail.isLoading ? (
                            <p className="text-sm text-muted-foreground" role="status">
                                Loading entry…
                            </p>
                        ) : detail.error ? (
                            <p className="text-sm text-muted-foreground" role="alert">
                                {detail.error}
                            </p>
                        ) : detail.data ? (
                            <>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={statusVariant(detail.data.status)}>
                                        {String(detail.data.status ?? "unknown")}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                        {String(detail.data.event_key ?? "")}
                                    </span>
                                </div>
                                <dl className="flex flex-col gap-2 text-sm">
                                    <div>
                                        <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                            Recipient (masked)
                                        </dt>
                                        <dd className="tabular-nums">{detail.data.to_email}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                            Sent at
                                        </dt>
                                        <dd className="tabular-nums">
                                            {String(detail.data.sent_at ?? "—")}
                                        </dd>
                                    </div>
                                    {detail.data.warnings.length > 0 ? (
                                        <div>
                                            <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                                Warnings
                                            </dt>
                                            <dd>
                                                <ul className="flex flex-col gap-1">
                                                    {detail.data.warnings.map((warning) => (
                                                        <li className="text-xs tabular-nums" key={warning}>
                                                            {warning}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </dd>
                                        </div>
                                    ) : null}
                                    {detail.data.error ? (
                                        <div>
                                            <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                                Error
                                            </dt>
                                            <dd className="text-xs">{detail.data.error}</dd>
                                        </div>
                                    ) : null}
                                    {detail.data.rendered_subject ? (
                                        <div>
                                            <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                                Rendered subject
                                            </dt>
                                            <dd>{detail.data.rendered_subject}</dd>
                                        </div>
                                    ) : null}
                                </dl>
                                {detail.data.rendered_body_html ? (
                                    <div className="overflow-hidden rounded-lg border">
                                        <iframe
                                            sandbox=""
                                            srcDoc={detail.data.rendered_body_html}
                                            style={{ border: 0, display: "block", height: 420, width: "100%" }}
                                            title="Rendered email body"
                                        />
                                    </div>
                                ) : null}
                            </>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </section>
    );
}
