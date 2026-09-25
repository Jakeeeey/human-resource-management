"use client";

import { ArrowDown, ArrowUp, Inbox } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { MsCombobox } from "./components/MsCombobox";
import { MsPager } from "./components/MsPager";
import { useMsCatalog } from "./hooks/useMsCatalog";
import { useMsOutbox } from "./hooks/useMsOutbox";
import { useMsOutboxRow } from "./hooks/useMsOutboxRow";
import type { MsMaskedOutboxRow } from "./utils/ms-mask";

const STATUS_FILTERS = ["all", "queued", "sent", "failed", "skipped", "dry_run"] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];

type OutboxSort = "-id" | "id" | "status" | "-status";

const SEARCH_DEBOUNCE_MS = 350;

function statusVariant(status: unknown): "default" | "secondary" | "destructive" | "outline" {
    if (status === "sent") return "default";
    if (status === "failed") return "destructive";
    if (status === "queued") return "secondary";
    return "outline";
}

function formatMsDateTime(value: unknown): string {
    if (typeof value !== "string" || value.trim().length === 0) return "—";
    const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));
    if (Number.isNaN(parsed.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }).format(parsed);
}

function rowMeta(row: MsMaskedOutboxRow): string {
    const event = typeof row.event_key === "string" && row.event_key ? row.event_key : "no event";
    const sent = formatMsDateTime(row.sent_at);
    if (sent !== "—") return `${event} · ${sent}`;
    if (typeof row.attempts === "number") {
        return `${event} · ${row.attempts} attempt${row.attempts === 1 ? "" : "s"} · not sent`;
    }
    return `${event} · not sent`;
}

function rowTitle(row: MsMaskedOutboxRow): string {
    return `${row.to_email} · ${String(row.status ?? "unknown")} · ${String(row.event_key ?? "no event")}`;
}

/**
 * Outbox tab — read-only viewer over the real outbox routes. Recipients
 * arrive masked from the server; there is deliberately NO resend action on
 * this path (D17 — no resend endpoint exists), so none is rendered. The
 * list pages server-side (10 per page, QA §11) with status + event-key
 * filters, recipient/event/key search, and Date/Status sort — and never
 * ships `rendered_body_html` (fetched per-row on select). Pre-terminal rows
 * (`queued`) never show a sent-at timestamp: `Sent at` stays `—` until a
 * terminal `sent`, with attempts/next-attempt and a "Last attempt" line
 * instead of a terminal-looking ERROR.
 */
export function OutboxPage() {
    const [filter, setFilter] = useState<StatusFilter>("all");
    const [eventKey, setEventKey] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState<OutboxSort>("-id");
    const [page, setPage] = useState(1);
    const [selectedId, setSelectedId] = useState<string | number | null>(null);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
            setSelectedId(null);
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    const { data, isLoading, error, refetch } = useMsOutbox({
        ...(filter === "all" ? {} : { status: filter }),
        ...(eventKey ? { eventKey } : {}),
        ...(search ? { search } : {}),
        sort,
        page,
    });
    const detail = useMsOutboxRow(selectedId);
    const catalog = useMsCatalog();

    const eventOptions = useMemo(() => {
        return (catalog.data ?? [])
            .map((row) => ({ value: row.event_key, label: `${row.event_key} — ${row.label}` }))
            .sort((a, b) => a.value.localeCompare(b.value));
    }, [catalog.data]);

    const total = data?.total ?? 0;
    const limit = data?.limit ?? 10;
    const rows = data?.rows ?? [];
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
    const rangeEnd = (page - 1) * limit + rows.length;

    const dateActive = sort === "-id" || sort === "id";
    const statusActive = sort === "status" || sort === "-status";
    const dateLabel = sort === "id" ? "oldest first" : "newest first";
    const statusLabel =
        sort === "-status" ? "reverse alphabetical" : "alphabetical";

    const resetToFirstPage = (): void => {
        setPage(1);
        setSelectedId(null);
    };

    const filtersActive = filter !== "all" || eventKey !== "" || search !== "";

    return (
        <section aria-label="Outbox" className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Status filter">
                    {STATUS_FILTERS.map((status) => (
                        <button
                            aria-pressed={filter === status}
                            className={cn(
                                "min-h-11 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150 md:min-h-0",
                                filter === status
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                            )}
                            data-testid={`outbox-filter-${status}`}
                            key={status}
                            type="button"
                            onClick={() => {
                                setFilter(status);
                                resetToFirstPage();
                            }}
                        >
                            {status}
                        </button>
                    ))}
                </div>
                <Button
                    aria-label="Refresh outbox"
                    className="min-h-11 md:min-h-0"
                    disabled={isLoading}
                    size="sm"
                    variant="outline"
                    onClick={() => void refetch()}
                >
                    Refresh
                </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="w-52 max-w-full">
                    <MsCombobox
                        ariaLabel="Filter by event key"
                        disabled={catalog.isLoading}
                        emptyText="No event keys."
                        id="outbox-event-filter"
                        options={eventOptions}
                        placeholder={catalog.isLoading ? "Loading events…" : "All events"}
                        searchPlaceholder="Search events…"
                        value={eventKey}
                        onValueChange={(next) => {
                            setEventKey(next);
                            resetToFirstPage();
                        }}
                    />
                </div>
                <Input
                    aria-label="Search outbox by recipient, event, or key"
                    className="h-8 max-w-xs text-xs"
                    placeholder="Search recipient, event, or key…"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                />
                <div className="flex items-center gap-1" role="group" aria-label="Sort outbox">
                    <Button
                        aria-label={`Sort by date, currently ${dateActive ? dateLabel : "not sorted by date"}`}
                        aria-pressed={dateActive}
                        className="min-h-11 md:min-h-0"
                        size="sm"
                        variant={dateActive ? "default" : "outline"}
                        title="Sorts by creation order (newest/oldest)"
                        onClick={() => {
                            setSort((current) => (current === "-id" ? "id" : "-id"));
                            resetToFirstPage();
                        }}
                    >
                        Date
                        {dateActive ? (
                            sort === "id" ? (
                                <ArrowUp aria-hidden="true" />
                            ) : (
                                <ArrowDown aria-hidden="true" />
                            )
                        ) : null}
                    </Button>
                    <Button
                        aria-label={`Sort by status, currently ${statusActive ? statusLabel : "not sorted by status"}`}
                        aria-pressed={statusActive}
                        className="min-h-11 md:min-h-0"
                        size="sm"
                        variant={statusActive ? "default" : "outline"}
                        onClick={() => {
                            setSort((current) => (current === "status" ? "-status" : "status"));
                            resetToFirstPage();
                        }}
                    >
                        Status
                        {statusActive ? (
                            sort === "-status" ? (
                                <ArrowUp aria-hidden="true" />
                            ) : (
                                <ArrowDown aria-hidden="true" />
                            )
                        ) : null}
                    </Button>
                </div>
                {filtersActive ? (
                    <Button
                        aria-label="Clear outbox filters"
                        className="min-h-11 md:min-h-0"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                            setFilter("all");
                            setEventKey("");
                            setSearchInput("");
                            setSearch("");
                            resetToFirstPage();
                        }}
                    >
                        Clear
                    </Button>
                ) : null}
            </div>

            {catalog.error ? (
                <p className="text-[11px] leading-snug text-muted-foreground" role="status">
                    Event list failed to load — event filtering is unavailable.
                </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2">
                <p
                    aria-live="polite"
                    className="text-xs text-muted-foreground tabular-nums"
                    data-testid="outbox-count"
                >
                    {isLoading && !data
                        ? "Loading outbox…"
                        : total === 0
                          ? "No entries"
                          : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
                </p>
                <p className="text-[11px] text-muted-foreground">
                    Recipients masked — full addresses never leave the server.
                </p>
            </div>

            {isLoading && !data ? (
                <div className="flex flex-col gap-2" data-testid="outbox-loading" role="status" aria-label="Loading outbox">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <span className="sr-only">Loading outbox…</span>
                </div>
            ) : null}

            {error ? (
                <div
                    className="rounded-lg border border-destructive/40 bg-card p-4"
                    data-testid="outbox-error"
                    role="alert"
                >
                    <p className="text-sm text-destructive">{error}</p>
                    <Button className="mt-2 min-h-11 md:min-h-0" size="sm" variant="outline" onClick={() => void refetch()}>
                        Retry
                    </Button>
                </div>
            ) : null}

            {!isLoading && !error && data && total === 0 ? (
                <div
                    className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-16 text-center"
                    data-testid="outbox-empty"
                >
                    <Inbox aria-hidden="true" className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                        {filtersActive
                            ? "No outbox entries match these filters."
                            : "No outbox entries yet."}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {filtersActive
                            ? "Try another status or event, clear the search, or send a test from the Send tab."
                            : "Send a test from the Send tab to record the first entry."}
                    </p>
                </div>
            ) : null}

            {rows.length > 0 ? (
                <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
                    <ul className="flex flex-col gap-2 overflow-y-auto" data-testid="outbox-list">
                        {rows.map((row) => (
                            <li key={String(row.id ?? row.idempotency_key)}>
                                <button
                                    aria-pressed={selectedId === row.id}
                                    className={cn(
                                        "flex min-h-11 w-full flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-left transition-colors duration-150 hover:border-primary/40",
                                        selectedId === row.id ? "border-primary/60" : undefined,
                                    )}
                                    data-testid="outbox-row"
                                    title={rowTitle(row)}
                                    type="button"
                                    onClick={() => setSelectedId(
                                        typeof row.id === "string" || typeof row.id === "number"
                                            ? row.id
                                            : null,
                                    )}
                                >
                                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span className="truncate text-sm font-medium tabular-nums">
                                            {row.to_email}
                                        </span>
                                        <span className="truncate text-xs text-muted-foreground tabular-nums">
                                            {rowMeta(row)}
                                        </span>
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
                            <p className="text-sm text-destructive" role="alert">
                                {detail.error}
                            </p>
                        ) : detail.data ? (
                            <OutboxDetailPane row={detail.data} />
                        ) : null}
                    </div>
                </div>
            ) : null}
            <MsPager page={page} totalPages={totalPages} onPage={(next) => {
                setPage(next);
                setSelectedId(null);
            }} />
        </section>
    );
}

function OutboxDetailPane({ row }: { readonly row: MsMaskedOutboxRow }) {
    const status = String(row.status ?? "unknown");
    const isSent = status === "sent";
    const isQueued = status === "queued";
    const isFailed = status === "failed";
    const sentLabel = isSent ? formatMsDateTime(row.sent_at) : "—";
    const sentTitle =
        isSent && typeof row.sent_at === "string" && row.sent_at ? row.sent_at : undefined;
    const nextAttemptLabel =
        typeof row.next_attempt_at === "string" && row.next_attempt_at
            ? formatMsDateTime(row.next_attempt_at)
            : "—";
    const errorLabel = isQueued ? "Last attempt — retrying" : "Last attempt";
    const hasSnapshot = Boolean(row.rendered_subject ?? row.rendered_body_html);

    return (
        <>
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(row.status)}>
                    {status}
                </Badge>
                <span className="text-xs text-muted-foreground tabular-nums">
                    {String(row.event_key ?? "")}
                </span>
            </div>
            {isQueued ? (
                <p className="text-xs text-muted-foreground" role="status">
                    Awaiting delivery — no sent timestamp until the send lands.
                </p>
            ) : null}
            {isFailed && hasSnapshot ? (
                <p className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive" role="status">
                    Not delivered — last rendered snapshot below.
                </p>
            ) : null}
            <dl className="flex flex-col gap-2 text-sm">
                <div>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Id
                    </dt>
                    <dd className="tabular-nums">{String(row.id ?? "—")}</dd>
                </div>
                <div>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Idempotency key
                    </dt>
                    <dd className="break-all tabular-nums">{String(row.idempotency_key ?? "—")}</dd>
                </div>
                <div>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Template
                    </dt>
                    <dd className="tabular-nums">{String(row.template_id ?? "—")}</dd>
                </div>
                <div>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Recipient (masked)
                    </dt>
                    <dd className="tabular-nums">{row.to_email}</dd>
                </div>
                <div>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Sent at
                    </dt>
                    <dd className="tabular-nums" title={sentTitle}>
                        {sentLabel}
                    </dd>
                </div>
                {typeof row.attempts === "number" ? (
                    <div>
                        <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                            Attempts
                        </dt>
                        <dd className="tabular-nums">{row.attempts}</dd>
                    </div>
                ) : null}
                {isQueued || row.next_attempt_at ? (
                    <div>
                        <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                            Next attempt
                        </dt>
                        <dd className="tabular-nums" title={row.next_attempt_at ?? undefined}>
                            {nextAttemptLabel}
                        </dd>
                    </div>
                ) : null}
                {row.warnings.length > 0 ? (
                    <div>
                        <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                            Warnings
                        </dt>
                        <dd>
                            <ul className="flex flex-col gap-1">
                                {row.warnings.map((warning) => (
                                    <li className="text-xs tabular-nums" key={warning}>
                                        {warning}
                                    </li>
                                ))}
                            </ul>
                        </dd>
                    </div>
                ) : null}
                {row.error ? (
                    <div>
                        <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                            {errorLabel}
                        </dt>
                        <dd className="text-xs">{row.error}</dd>
                    </div>
                ) : null}
                {row.rendered_subject ? (
                    <div>
                        <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                            Rendered subject
                        </dt>
                        <dd>{row.rendered_subject}</dd>
                    </div>
                ) : null}
            </dl>
            {row.rendered_body_html ? (
                <div className="overflow-hidden rounded-lg border">
                    <iframe
                        sandbox=""
                        srcDoc={row.rendered_body_html}
                        style={{ border: 0, display: "block", height: 420, width: "100%" }}
                        title="Rendered email body"
                    />
                </div>
            ) : null}
        </>
    );
}
