"use client";

import { useMemo, useState } from "react";
import { Loader2, MailX, MoreVertical, RefreshCw, SearchX, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import { MsConfirmDialog } from "./components/MsConfirmDialog";
import { MsPager } from "./components/MsPager";
import { SuppressionDialog } from "./components/SuppressionDialog";
import { useMsPagination } from "./hooks/useMsPagination";
import { useMsSuppressionsContext } from "./providers/MsSuppressionsProvider";
import { removeMsSuppression } from "./providers/msSuppressionsClient";
import { SUPPRESSION_REASONS, SUPPRESSION_REASON_LABELS, type SuppressionReason } from "./types";
import type { MsSuppressionRow } from "./types";
import { formatPHT } from "./utils/time";

type ReasonFilter = "all" | SuppressionReason;

type SuppressionSort = "recent" | "email";

interface SuppressionNotice {
    readonly tone: "info" | "error";
    readonly text: string;
}

const SORT_OPTIONS: readonly { readonly value: SuppressionSort; readonly label: string }[] = [
    { value: "recent", label: "Recently added" },
    { value: "email", label: "Email A–Z" },
];

export function SuppressionsPage() {
    const { suppressions, total, isLoading, error, refresh } = useMsSuppressionsContext();
    const [search, setSearch] = useState("");
    const [reason, setReason] = useState<ReasonFilter>("all");
    const [sort, setSort] = useState<SuppressionSort>("recent");
    const [createOpen, setCreateOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<MsSuppressionRow | null>(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [notice, setNotice] = useState<SuppressionNotice | null>(null);
    const [retrying, setRetrying] = useState(false);

    const existingEmails = useMemo(
        () => (suppressions ?? []).map((row) => row.email.trim().toLowerCase()),
        [suppressions]
    );

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        const rows = (suppressions ?? []).filter((row) => {
            if (reason !== "all" && row.reason !== reason) return false;
            if (!query) return true;
            return (
                row.email.toLowerCase().includes(query) ||
                (row.note ?? "").toLowerCase().includes(query)
            );
        });
        return [...rows].sort((a, b) => {
            if (sort === "email") return a.email.localeCompare(b.email);
            return b.id - a.id;
        });
    }, [suppressions, search, reason, sort]);

    const { page, totalPages, pageItems, setPage, resetPage } = useMsPagination(filtered.length);
    const visible = pageItems(filtered);
    const isNarrowed = search.trim() !== "" || reason !== "all";

    const handleRetry = async (): Promise<void> => {
        setRetrying(true);
        try {
            await refresh();
        } finally {
            setRetrying(false);
        }
    };

    const handleDuplicate = (email: string): void => {
        setNotice({ tone: "info", text: `${email} is already suppressed — the existing entry was kept.` });
    };

    const handleSaved = async (): Promise<void> => {
        setNotice({ tone: "info", text: "Address suppressed." });
        await refresh();
    };

    const handleDeleteConfirm = async (): Promise<void> => {
        if (!deleteTarget) return;
        setDeleteBusy(true);
        try {
            const message = await removeMsSuppression(deleteTarget.id);
            setDeleteTarget(null);
            setNotice({ tone: "info", text: message });
            await refresh();
        } catch (cause) {
            setNotice({ tone: "error", text: cause instanceof Error ? cause.message : String(cause) });
            setDeleteTarget(null);
        } finally {
            setDeleteBusy(false);
        }
    };

    return (
        <section aria-label="Suppressions" className="flex min-h-0 flex-1 flex-col gap-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="p-3 bg-primary/10 rounded-2xl text-primary">
                        <MailX className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold tracking-tight">Suppressions</h1>
                        <p className="text-sm text-muted-foreground">Addresses held back from every studio send.</p>
                    </div>
                </div>
                <Button aria-label="Add suppression" className="min-h-11 md:min-h-0" size="sm" onClick={() => setCreateOpen(true)}>
                    Add suppression
                </Button>
            </header>

            <div className="flex flex-wrap items-center gap-2">
                <Input
                    aria-label="Search suppressions"
                    className="h-8 w-full text-xs sm:max-w-xs"
                    placeholder="Search email or note…"
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        resetPage();
                    }}
                />
                <Select
                    value={reason}
                    onValueChange={(next) => {
                        setReason(next as ReasonFilter);
                        resetPage();
                    }}
                >
                    <SelectTrigger aria-label="Filter suppressions by reason" className="h-8 max-w-[220px] text-xs" size="sm">
                        <SelectValue placeholder="Reason" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                        <SelectItem value="all">All reasons</SelectItem>
                        {SUPPRESSION_REASONS.map((option) => (
                            <SelectItem key={option} value={option}>
                                {SUPPRESSION_REASON_LABELS[option]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select
                    value={sort}
                    onValueChange={(next) => {
                        setSort(next as SuppressionSort);
                        resetPage();
                    }}
                >
                    <SelectTrigger aria-label="Sort suppressions" className="h-8 max-w-[220px] text-xs" size="sm">
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
                    aria-label="Refresh suppressions"
                    className="min-h-11 md:min-h-0"
                    disabled={isLoading}
                    size="sm"
                    variant="outline"
                    onClick={() => void refresh()}
                >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh
                </Button>
                {suppressions ? (
                    <span
                        className="ms-auto rounded-full border bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground tabular-nums"
                        data-testid="suppressions-count"
                    >
                        {isNarrowed ? `${filtered.length} of ${total}` : `${total}`} suppressed
                    </span>
                ) : null}
            </div>

            {notice ? (
                <div
                    className={
                        notice.tone === "error"
                            ? "rounded-lg border border-destructive/40 bg-card p-4"
                            : "rounded-lg border bg-card p-4"
                    }
                    data-testid="suppressions-notice"
                    role={notice.tone === "error" ? "alert" : "status"}
                >
                    <p className={notice.tone === "error" ? "text-sm text-destructive" : "text-sm"}>{notice.text}</p>
                </div>
            ) : null}

            {isLoading && !suppressions ? (
                <div className="flex flex-col gap-2" data-testid="suppressions-loading" role="status" aria-label="Loading suppressions">
                    {[0, 1].map((index) => (
                        <div className="flex items-center gap-3 rounded-lg border bg-card p-3" key={index}>
                            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-3 w-1/4" />
                            </div>
                            <Skeleton className="h-5 w-20 rounded-full" />
                        </div>
                    ))}
                    <span className="sr-only">Loading suppressions…</span>
                </div>
            ) : null}

            {error ? (
                <div className="rounded-lg border border-destructive/40 bg-card p-4" data-testid="suppressions-error" role="alert">
                    <p className="text-sm text-destructive">{error}</p>
                    <Button className="mt-2 min-h-11 md:min-h-0" disabled={retrying} size="sm" variant="outline" onClick={() => void handleRetry()}>
                        {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Retry
                    </Button>
                </div>
            ) : null}

            {!isLoading && !error && suppressions && suppressions.length === 0 ? (
                <div
                    className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-16 text-center"
                    data-testid="suppressions-empty"
                >
                    <MailX aria-hidden="true" className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No suppressed addresses.</p>
                    <Button className="min-h-11 md:min-h-0" size="sm" onClick={() => setCreateOpen(true)}>
                        Suppress the first address
                    </Button>
                </div>
            ) : null}

            {!isLoading && !error && suppressions && suppressions.length > 0 && filtered.length === 0 ? (
                <div
                    className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-16 text-center"
                    data-testid="suppressions-no-match"
                >
                    <SearchX aria-hidden="true" className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No suppressions match the current filter.</p>
                    <p className="text-xs text-muted-foreground">Try a different search.</p>
                </div>
            ) : null}

            {visible.length > 0 ? (
                <ul className="flex flex-col gap-2" data-testid="suppressions-list">
                    {visible.map((row) => (
                        <li
                            className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors duration-150 hover:border-primary/40"
                            data-testid="suppression-row"
                            key={row.id}
                        >
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="truncate text-sm font-medium" title={row.email}>
                                    {row.email}
                                </span>
                                <span className="truncate text-xs text-muted-foreground" title={row.note ?? ""}>
                                    {row.note && row.note.trim() !== "" ? row.note : "No note"}
                                </span>
                                <span className="text-xs text-muted-foreground">Added {formatPHT(row.created_at)}</span>
                            </div>
                            <Badge className="border-border bg-muted text-muted-foreground" variant="outline">
                                {SUPPRESSION_REASON_LABELS[row.reason]}
                            </Badge>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        aria-label={`Actions for suppressed address ${row.email}`}
                                        className="h-8 w-8 shrink-0"
                                        size="icon"
                                        variant="ghost"
                                    >
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[180px]">
                                    <DropdownMenuItem
                                        className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                        onSelect={() => setDeleteTarget(row)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Remove
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </li>
                    ))}
                </ul>
            ) : null}
            <MsPager page={page} totalPages={totalPages} onPage={setPage} />

            <SuppressionDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                existingEmails={existingEmails}
                onDuplicate={handleDuplicate}
                onSaved={() => void handleSaved()}
            />
            <MsConfirmDialog
                busy={deleteBusy}
                busyLabel="Removing…"
                confirmLabel="Remove suppression"
                description={deleteTarget ? `${deleteTarget.email} will become eligible for studio sends again.` : "Remove this suppression?"}
                open={deleteTarget !== null}
                title={deleteTarget ? `Remove ${deleteTarget.email}?` : "Remove this suppression?"}
                onConfirm={() => void handleDeleteConfirm()}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
            />
        </section>
    );
}
