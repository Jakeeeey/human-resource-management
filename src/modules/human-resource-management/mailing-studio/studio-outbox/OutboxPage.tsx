"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Inbox,
    Loader2,
    RefreshCw,
    Send,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { MsCombobox } from "./components/MsCombobox";
import { MsPager } from "./components/MsPager";
import { useMsCatalog } from "./hooks/useMsCatalog";
import { useMsOutbox } from "./hooks/useMsOutbox";
import { useMsOutboxRow } from "./hooks/useMsOutboxRow";
import type { MsOutboxRow } from "./types/ms-outbox-row";

const STATUS_FILTERS = [
    { value: "all", label: "All" },
    { value: "queued", label: "Queued" },
    { value: "sent", label: "Sent" },
    { value: "failed", label: "Failed" },
    { value: "skipped", label: "Skipped" },
    { value: "dry_run", label: "Dry run" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

type OutboxSort = "-id" | "id" | "status" | "-status";

const SORT_OPTIONS: readonly { readonly value: OutboxSort; readonly label: string }[] = [
    { value: "-id", label: "Newest first" },
    { value: "id", label: "Oldest first" },
    { value: "status", label: "Status A–Z" },
    { value: "-status", label: "Status Z–A" },
];

const SEARCH_DEBOUNCE_MS = 350;

function stripMachineCode(message: string): string {
    const stripped = message.replace(/^(?:[A-Z][A-Z0-9_]*:\s*)+/, "").trim();
    return stripped === "" ? message.trim() : stripped;
}

function humaniseOutboxError(message: string): string {
    const upper = message.toUpperCase();
    if (upper.includes("NOT_FOUND")) {
        return "That entry no longer exists — refresh the list and try again.";
    }
    const stripped = stripMachineCode(message);
    if (stripped !== "") return stripped;
    return "Something went wrong — please try again.";
}

function statusTone(status: unknown): string {
    if (status === "sent") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    if (status === "failed") return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400";
    if (status === "queued") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
    if (status === "dry_run") return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400";
    return "border-border bg-muted text-muted-foreground";
}

function statusDisplay(status: unknown): string {
    if (status === "dry_run") return "Dry run";
    return String(status ?? "unknown");
}

function recipientLabel(row: MsOutboxRow): string {
    const value = typeof row.to_email === "string" ? row.to_email.trim() : "";
    return value === "" ? "No recipient" : value;
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

function rowSubject(row: MsOutboxRow): string {
    if (typeof row.rendered_subject === "string" && row.rendered_subject.trim().length > 0) {
        return row.rendered_subject;
    }
    if (typeof row.event_key === "string" && row.event_key.trim().length > 0) {
        return row.event_key;
    }
    return "—";
}

function OutboxRowCard({
    row,
    selected,
    onSelect,
}: {
    readonly row: MsOutboxRow;
    readonly selected: boolean;
    readonly onSelect: () => void;
}) {
    const recipient = recipientLabel(row);
    const subject = rowSubject(row);
    const sentDisplay = formatMsDateTime(row.sent_at);
    const sentTitle = typeof row.sent_at === "string" && row.sent_at ? row.sent_at : sentDisplay;
    return (
        <li data-testid="outbox-row">
            <button
                type="button"
                aria-pressed={selected}
                onClick={onSelect}
                className={cn(
                    "flex w-full flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-left transition-colors duration-150 hover:border-primary/40",
                    selected ? "border-primary/60" : undefined,
                )}
            >
                <Badge className={statusTone(row.status)} variant="outline">
                    {statusDisplay(row.status)}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-sm font-medium" title={recipient}>
                    {recipient}
                </span>
                <span className="min-w-0 basis-full truncate text-xs text-muted-foreground sm:basis-auto sm:max-w-56" title={subject}>
                    {subject}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums" title={sentTitle}>
                    {sentDisplay}
                </span>
            </button>
        </li>
    );
}

export function OutboxPage() {
    const [filter, setFilter] = useState<StatusFilter>("all");
    const [eventKey, setEventKey] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState<OutboxSort>("-id");
    const [page, setPage] = useState(1);
    const [selectedId, setSelectedId] = useState<string | number | null>(null);
    const [retrying, setRetrying] = useState(false);
    const [detailRetrying, setDetailRetrying] = useState(false);

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

    const resetToFirstPage = (): void => {
        setPage(1);
        setSelectedId(null);
    };

    const selectRow = (row: MsOutboxRow): void => {
        setSelectedId(
            typeof row.id === "string" || typeof row.id === "number" ? row.id : null,
        );
    };

    const handleRetry = async (): Promise<void> => {
        setRetrying(true);
        try {
            await refetch();
        } finally {
            setRetrying(false);
        }
    };

    const handleDetailRetry = async (): Promise<void> => {
        setDetailRetrying(true);
        try {
            await detail.refetch();
        } finally {
            setDetailRetrying(false);
        }
    };

    const filtersActive = filter !== "all" || eventKey !== "" || search !== "";
    const countLabel = isLoading && !data
        ? "Loading…"
        : total === 0
          ? "No entries"
          : `Showing ${rangeStart}–${rangeEnd} of ${total}`;

    return (
        <section aria-label="Outbox" className="flex min-h-0 flex-1 flex-col gap-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="p-3 bg-primary/10 rounded-2xl text-primary">
                        <Send className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold tracking-tight">Outbox</h1>
                        <p className="text-sm text-muted-foreground">The record of everything the studio has sent and queued.</p>
                    </div>
                </div>
            </header>

            <div className="flex flex-wrap items-center gap-2">
                <Input
                    aria-label="Search outbox by recipient, event, or key"
                    className="h-8 w-full text-xs sm:max-w-xs"
                    placeholder="Search recipient, event, or key…"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                />
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
                <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Status filter">
                    {STATUS_FILTERS.map((status) => (
                        <button
                            aria-pressed={filter === status.value}
                            className={cn(
                                "min-h-11 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150 md:min-h-0",
                                filter === status.value
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                            )}
                            data-testid={`outbox-filter-${status.value}`}
                            key={status.value}
                            type="button"
                            onClick={() => {
                                setFilter(status.value);
                                resetToFirstPage();
                            }}
                        >
                            {status.label}
                        </button>
                    ))}
                </div>
                <Select
                    value={sort}
                    onValueChange={(next) => {
                        setSort(next as OutboxSort);
                        resetToFirstPage();
                    }}
                >
                    <SelectTrigger aria-label="Sort outbox" className="h-8 max-w-[220px] text-xs" size="sm">
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
                <Button
                    aria-label="Refresh outbox"
                    className="min-h-11 md:min-h-0"
                    disabled={isLoading}
                    size="sm"
                    variant="outline"
                    onClick={() => void refetch()}
                >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh
                </Button>
                <span
                    className="ms-auto rounded-full border bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground tabular-nums"
                    data-testid="outbox-count"
                >
                    {countLabel}
                </span>
            </div>

            {catalog.error ? (
                <p className="text-[11px] leading-snug text-muted-foreground" role="status">
                    Event list failed to load — event filtering is unavailable.
                </p>
            ) : null}

            {isLoading && !data ? (
                <div className="flex flex-col gap-2" data-testid="outbox-loading" role="status" aria-label="Loading outbox">
                    {[0, 1].map((index) => (
                        <div className="flex flex-col gap-2 rounded-lg border bg-card p-3" key={index}>
                            <div className="flex items-start gap-3">
                                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                    <Skeleton className="h-4 w-1/3" />
                                    <Skeleton className="h-3 w-2/3" />
                                </div>
                                <Skeleton className="h-5 w-14 rounded-full" />
                                <Skeleton className="h-8 w-8 rounded-md" />
                            </div>
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    ))}
                    <span className="sr-only">Loading outbox…</span>
                </div>
            ) : null}

            {error ? (
                <div
                    className="rounded-lg border border-destructive/40 bg-card p-4"
                    data-testid="outbox-error"
                    role="alert"
                >
                    <p className="text-sm text-destructive">{humaniseOutboxError(error)}</p>
                    <Button className="mt-2 min-h-11 md:min-h-0" disabled={retrying} size="sm" variant="outline" onClick={() => void handleRetry()}>
                        {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
                <div className="grid gap-3 lg:grid-cols-[minmax(0,9fr)_minmax(0,11fr)]">
                    <div className="overflow-hidden rounded-lg border bg-card">
                        <ul aria-label="Outbox rows" className="flex max-h-[560px] flex-col gap-2 overflow-y-auto p-3" data-testid="outbox-list">
                            {rows.map((row) => (
                                <OutboxRowCard
                                    key={String(row.id ?? row.idempotency_key)}
                                    row={row}
                                    selected={selectedId === row.id}
                                    onSelect={() => selectRow(row)}
                                />
                            ))}
                        </ul>
                    </div>

                    <div className="hidden lg:block">
                        <div
                            className="flex h-[560px] min-h-0 flex-col gap-3 overflow-y-auto rounded-lg border bg-card p-4"
                            data-testid="outbox-detail"
                        >
                            {selectedId === null ? (
                                <p className="min-h-0 flex-1 text-sm text-muted-foreground">Select a row to preview.</p>
                            ) : detail.isLoading ? (
                                <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading entry…
                                </p>
                            ) : detail.error ? (
                                <div className="flex flex-col gap-2" role="alert">
                                    <p className="text-sm text-destructive">{humaniseOutboxError(detail.error)}</p>
                                    <Button className="mt-1 min-h-11 self-start md:min-h-0" disabled={detailRetrying} size="sm" variant="outline" onClick={() => void handleDetailRetry()}>
                                        {detailRetrying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                        Retry
                                    </Button>
                                </div>
                            ) : detail.data ? (
                                <OutboxDetailPane row={detail.data} />
                            ) : null}
                        </div>
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

function OutboxDetailPane({ row }: { readonly row: MsOutboxRow }) {
    const status = String(row.status ?? "unknown");
    const isSent = status === "sent";
    const isQueued = status === "queued";
    const isFailed = status === "failed";
    const recipient = recipientLabel(row);
    const eventKey = typeof row.event_key === "string" ? row.event_key : String(row.event_key ?? "");
    const sentLabel = isSent ? formatMsDateTime(row.sent_at) : "—";
    const sentTitle =
        isSent && typeof row.sent_at === "string" && row.sent_at ? row.sent_at : undefined;
    const nextAttemptLabel =
        typeof row.next_attempt_at === "string" && row.next_attempt_at
            ? formatMsDateTime(row.next_attempt_at)
            : "—";
    const errorLabel = isQueued ? "Last attempt — retrying" : "Last attempt";
    const hasSnapshot = Boolean(row.rendered_subject ?? row.rendered_body_html);
    const subject = typeof row.rendered_subject === "string" ? row.rendered_subject : "";

    return (
        <>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Badge className={statusTone(row.status)} variant="outline">
                    {statusDisplay(row.status)}
                </Badge>
                <span className="min-w-0 max-w-60 flex-1 truncate font-mono text-xs text-muted-foreground" title={eventKey}>
                    {eventKey}
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
            <dl className="flex min-w-0 flex-col gap-2 text-sm">
                <div>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Id
                    </dt>
                    <dd className="truncate font-mono" title={String(row.id ?? "—")}>{String(row.id ?? "—")}</dd>
                </div>
                <div>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Idempotency key
                    </dt>
                    <dd className="break-all font-mono" title={String(row.idempotency_key ?? "—")}>{String(row.idempotency_key ?? "—")}</dd>
                </div>
                <div>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Template
                    </dt>
                    <dd className="truncate font-mono" title={String(row.template_id ?? "—")}>{String(row.template_id ?? "—")}</dd>
                </div>
                <div>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Recipient
                    </dt>
                    <dd className="truncate font-mono" title={recipient}>{recipient}</dd>
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
                                    <li className="break-words text-xs" key={warning}>
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
                        <dd className="break-words text-xs">{humaniseOutboxError(row.error)}</dd>
                    </div>
                ) : null}
                {subject.trim().length > 0 ? (
                    <div>
                        <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                            Rendered subject
                        </dt>
                        <dd className="truncate" title={subject}>{subject}</dd>
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
