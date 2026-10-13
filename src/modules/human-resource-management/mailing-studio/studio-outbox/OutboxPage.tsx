"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Inbox,
    Loader2,
    RefreshCw,
    Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { MsCombobox } from "./components/MsCombobox";
import { MsPager } from "./components/MsPager";
import { useMsOutbox } from "./hooks/useMsOutbox";
import { useMsOutboxRow } from "./hooks/useMsOutboxRow";
import { useMsTemplates } from "./hooks/useMsTemplates";
import type { MsOutboxRow } from "./types/ms-outbox-row";
import { msOutboxPreviewHtml } from "./utils/ms-preview-images";

const STATUS_OPTIONS = [
    { value: "", label: "All statuses" },
    { value: "queued", label: "Queued" },
    { value: "sent", label: "Sent" },
    { value: "failed", label: "Failed" },
    { value: "skipped", label: "Skipped" },
    { value: "dry_run", label: "Dry run" },
] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number]["value"];

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

function outcomeTone(status: unknown): string {
    if (status === "sent") return "badge-success";
    if (status === "failed") return "badge-destructive";
    if (status === "queued") return "badge-info";
    if (status === "dry_run") return "badge-warning";
    return "badge-neutral";
}

function outcomeLabel(status: unknown): string {
    const raw = typeof status === "string" && status.trim() !== "" ? status : "unknown";
    const spaced = raw.replace(/_/g, " ");
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function recipientEmail(row: MsOutboxRow): string {
    const value = typeof row.to_email === "string" ? row.to_email.trim() : "";
    return value === "" ? "No recipient" : value;
}

function friendlyDate(value: unknown): string {
    if (typeof value !== "string" || value.length === 0) return "—";
    const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

interface LinkedTemplate {
    readonly name: string;
    readonly subject: string;
}

function resolveSubject(row: MsOutboxRow, linked: LinkedTemplate | null): string {
    if (typeof row.rendered_subject === "string" && row.rendered_subject.trim().length > 0) {
        return row.rendered_subject;
    }
    if (linked !== null && linked.subject.trim().length > 0) {
        return linked.subject;
    }
    if (linked !== null && linked.name.trim().length > 0) {
        return linked.name;
    }
    return "—";
}

function rowId(row: MsOutboxRow): string | number | null {
    return typeof row.id === "string" || typeof row.id === "number" ? row.id : null;
}

function OutboxStatusPill({ status }: { readonly status: unknown }) {
    return (
        <span
            className={cn(
                "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors duration-150",
                outcomeTone(status),
            )}
        >
            {outcomeLabel(status)}
        </span>
    );
}

function OutboxRowCard({
    row,
    subject,
    selected,
    onSelect,
}: {
    readonly row: MsOutboxRow;
    readonly subject: string;
    readonly selected: boolean;
    readonly onSelect: () => void;
}) {
    const email = recipientEmail(row);
    const sentDisplay = friendlyDate(row.sent_at);
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
                <OutboxStatusPill status={row.status} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium" title={email}>
                    {email}
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

function OutboxDetailPane({
    row,
    linked,
}: {
    readonly row: MsOutboxRow;
    readonly linked: LinkedTemplate | null;
}) {
    const status = String(row.status ?? "unknown");
    const isQueued = status === "queued";
    const isFailed = status === "failed";
    const sentDisplay = friendlyDate(row.sent_at);
    const sentTitle = typeof row.sent_at === "string" && row.sent_at ? row.sent_at : undefined;
    const title = resolveSubject(row, linked);
    return (
        <div className="flex min-h-0 w-full max-w-full flex-1 flex-col gap-2 overflow-x-clip [overflow-wrap:break-word]">
            <div className="flex shrink-0 flex-wrap items-center gap-2">
                <OutboxStatusPill status={row.status} />
                <span className="text-xs text-muted-foreground tabular-nums" title={sentTitle}>
                    {sentDisplay}
                </span>
            </div>
            {isQueued ? (
                <p className="shrink-0 text-xs text-muted-foreground" role="status">
                    Awaiting delivery — no sent timestamp until the send lands.
                </p>
            ) : null}
            {isFailed ? (
                <p className="shrink-0 rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive" role="status">
                    Not delivered — last rendered snapshot below.
                </p>
            ) : null}
            {row.error ? (
                <p className="shrink-0 break-words text-xs text-destructive">{humaniseOutboxError(row.error)}</p>
            ) : null}
            <div className="flex min-h-0 w-full max-w-full flex-1 flex-col gap-3 rounded-xl border border-border/50 bg-muted/50 p-3 sm:p-4">
                <p className="shrink-0 truncate text-lg font-bold" title={title}>
                    {title}
                </p>
                <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-card p-4 text-sm leading-relaxed text-card-foreground shadow-sm">
                    {row.rendered_body_html ? (
                        <iframe
                            sandbox=""
                            srcDoc={msOutboxPreviewHtml(row.rendered_body_html)}
                            style={{ border: 0, display: "block", height: "100%", minHeight: 420, width: "100%" }}
                            title="Rendered email body"
                        />
                    ) : (
                        <p className="text-sm text-muted-foreground">No body recorded.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export function OutboxPage() {
    const [status, setStatus] = useState<StatusFilter>("");
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [selectedId, setSelectedId] = useState<string | number | null>(null);
    const [previewOpen, setPreviewOpen] = useState(true);
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
        ...(status !== "" ? { status } : {}),
        ...(search ? { search } : {}),
        sort: "-id",
        page,
        limit,
    });
    const templates = useMsTemplates();

    const templateById = useMemo(() => {
        const map = new Map<string, LinkedTemplate>();
        for (const entry of templates.data ?? []) {
            map.set(String(entry.id), { name: entry.name, subject: entry.subject });
        }
        return map;
    }, [templates.data]);

    const linkedFor = (row: MsOutboxRow): LinkedTemplate | null => {
        if (row.template_id === null || row.template_id === undefined) return null;
        return templateById.get(String(row.template_id)) ?? null;
    };

    const total = data?.total ?? 0;
    const serverLimit = data?.limit ?? limit;
    const rows = useMemo(() => data?.rows ?? [], [data]);
    const totalPages = Math.max(1, Math.ceil(total / serverLimit));

    const activeId = useMemo(() => {
        if (selectedId !== null && rows.some((row) => rowId(row) === selectedId)) {
            return selectedId;
        }
        const first = rows.find((row) => rowId(row) !== null);
        return first ? rowId(first) : null;
    }, [selectedId, rows]);

    const detail = useMsOutboxRow(activeId);

    const rangeStart = total === 0 || rows.length === 0 ? 0 : (page - 1) * serverLimit + 1;
    const rangeEnd = rows.length === 0 ? 0 : (page - 1) * serverLimit + rows.length;

    const resetToFirstPage = (): void => {
        setPage(1);
        setSelectedId(null);
    };

    const selectRow = (row: MsOutboxRow): void => {
        setSelectedId(rowId(row));
        setPreviewOpen(true);
    };

    const closePreview = (): void => {
        setPreviewOpen(false);
        setSelectedId(null);
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

    const filtersActive = status !== "" || search !== "";

    return (
        <section aria-label="Outbox" className="flex min-h-0 flex-1 flex-col gap-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="p-3 bg-primary/10 rounded-2xl text-primary">
                        <Send className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold tracking-tight">Outbox</h1>
                        <p className="text-sm text-muted-foreground">The record of event-driven mail the studio has sent and queued.</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {filtersActive ? (
                        <Button
                            aria-label="Clear outbox filters"
                            className="min-h-11 md:min-h-0"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                setStatus("");
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
                </div>
            </header>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
                <Input
                    aria-label="Search recipient or subject"
                    className="h-8 text-xs"
                    placeholder="Recipient or subject"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                />
                <MsCombobox
                    ariaLabel="Filter by status"
                    emptyText="No statuses."
                    id="outbox-status-filter"
                    onValueChange={(next) => {
                        setStatus(next as StatusFilter);
                        resetToFirstPage();
                    }}
                    options={STATUS_OPTIONS}
                    placeholder="All statuses"
                    searchPlaceholder="Search statuses…"
                    value={status}
                />
            </div>

            {templates.error ? (
                <p className="text-[11px] leading-snug text-muted-foreground" role="status">
                    Template list failed to load — subject fallback is unavailable.
                </p>
            ) : null}

            {isLoading && !data ? (
                <div className="flex flex-col gap-2" data-testid="outbox-loading" role="status" aria-label="Loading outbox">
                    {[0, 1, 2].map((index) => (
                        <div className="flex items-center gap-2 rounded-lg border bg-card p-3" key={index}>
                            <Skeleton className="h-5 w-16 rounded-full" />
                            <Skeleton className="h-4 flex-1" />
                            <Skeleton className="h-4 w-24" />
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
                            ? "Try another status or clear the search."
                            : "Send a test from Send to record the first entry."}
                    </p>
                </div>
            ) : null}

            {rows.length > 0 ? (
                <div className={previewOpen ? "grid items-stretch gap-3 lg:grid-cols-[minmax(0,9fr)_minmax(0,11fr)]" : "grid gap-3"}>
                    <div className="overflow-hidden rounded-lg border bg-card">
                        {rows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-16">
                                <p className="text-sm text-muted-foreground">No rows match these filters.</p>
                            </div>
                        ) : (
                            <ul aria-label="Outbox rows" className="flex max-h-[560px] flex-col gap-2 overflow-y-auto p-3" data-testid="outbox-list">
                                {rows.map((row) => (
                                    <OutboxRowCard
                                        key={String(row.id ?? row.idempotency_key)}
                                        row={row}
                                        subject={resolveSubject(row, linkedFor(row))}
                                        selected={activeId !== null && rowId(row) === activeId}
                                        onSelect={() => selectRow(row)}
                                    />
                                ))}
                            </ul>
                        )}
                        <MsPager
                            page={page}
                            pageSize={serverLimit}
                            totalPages={totalPages}
                            total={total}
                            rangeStart={rangeStart}
                            rangeEnd={rangeEnd}
                            onPage={(next) => {
                                setPage(next);
                                setSelectedId(null);
                            }}
                            onPageSize={(size) => {
                                setLimit(size);
                                setPage(1);
                                setSelectedId(null);
                            }}
                        />
                    </div>

                    {previewOpen ? (
                        <div className="hidden min-h-0 lg:flex lg:flex-col">
                            <div
                                className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-lg border bg-card p-4"
                                data-testid="outbox-detail"
                            >
                                {activeId === null ? (
                                    <p className="min-h-0 flex-1 text-sm text-muted-foreground">Select a row to preview.</p>
                                ) : detail.isLoading ? (
                                    <p className="flex min-h-0 flex-1 items-start gap-2 text-sm text-muted-foreground" role="status">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading entry…
                                    </p>
                                ) : detail.error ? (
                                    <div className="flex min-h-0 flex-1 flex-col items-start gap-2" role="alert">
                                        <p className="text-sm text-destructive">{humaniseOutboxError(detail.error)}</p>
                                        <Button className="mt-1 min-h-11 md:min-h-0" disabled={detailRetrying} size="sm" variant="outline" onClick={() => void handleDetailRetry()}>
                                            {detailRetrying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                            Retry
                                        </Button>
                                    </div>
                                ) : detail.data ? (
                                    <OutboxDetailPane row={detail.data} linked={linkedFor(detail.data)} />
                                ) : null}
                                <Button variant="outline" size="sm" className="mt-auto w-full shrink-0" onClick={closePreview}>
                                    Close preview
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
}
