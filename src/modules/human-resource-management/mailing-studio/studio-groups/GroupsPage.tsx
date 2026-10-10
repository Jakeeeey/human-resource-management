"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Loader2, MoreVertical, RefreshCw, RotateCw, SearchX, Trash2, UserPlus, Users, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { GroupDialog } from "./components/GroupDialog";
import { MemberDialog } from "./components/MemberDialog";
import { MsConfirmDialog } from "./components/MsConfirmDialog";
import { MsNotice, MS_NOTICE_AUTO_DISMISS_MS } from "./components/MsNotice";
import { MsPager } from "./components/MsPager";
import { useMsGroupMembers } from "./hooks/useMsGroupMembers";
import { useMsPagination } from "./hooks/useMsPagination";
import { useMsGroupsContext } from "./providers/MsGroupsProvider";
import {
    bulkRemoveMsGroupMembers,
    deleteMsGroup,
    fetchMsGroupMembers,
    removeMsGroupMember,
    resyncMsGroup,
    type MsAddGroupMembersResult,
    type MsGroupResyncResult,
} from "./providers/msGroupsClient";
import { GROUP_SOURCE_KIND_LABELS } from "./types";
import type { MemberSort, MsGroupMemberRow, MsGroupRow } from "./types";
import { formatPHT } from "./utils/time";

type GroupStatusFilter = "all" | "active" | "inactive";

type GroupSort = "name" | "recent";

interface GroupNotice {
    readonly tone: "info" | "error";
    readonly text: string;
}

const STATUS_OPTIONS: readonly { readonly value: GroupStatusFilter; readonly label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
];

const SORT_OPTIONS: readonly { readonly value: GroupSort; readonly label: string }[] = [
    { value: "name", label: "Name A–Z" },
    { value: "recent", label: "Recently created" },
];

function rowIsActive(row: MsGroupRow | MsGroupMemberRow): boolean {
    return row.is_active === true || row.is_active === 1;
}

function sourceLabel(kind: string): string {
    if (kind === "customer" || kind === "employee" || kind === "manual") return GROUP_SOURCE_KIND_LABELS[kind];
    const words = kind.replace(/_/g, " ").trim();
    return words.length === 0 ? "Unknown source" : words.charAt(0).toUpperCase() + words.slice(1);
}

function statusTone(active: boolean): string {
    if (active) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    return "border-border bg-muted text-muted-foreground";
}

function descriptionRestatesName(name: string, description: string | null): boolean {
    if (description === null) return false;
    const words = (value: string): string[] =>
        value
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter((word) => word !== "");
    const nameWords = new Set(words(name));
    if (nameWords.size === 0) return false;
    const ignored = new Set(["all", "the", "a", "an"]);
    const descriptionWords = words(description).filter((word) => !ignored.has(word));
    return descriptionWords.length > 0 && descriptionWords.every((word) => nameWords.has(word));
}

type MemberSortColumn = "email" | "source" | "added";

function memberColumnDirection(column: MemberSortColumn, sort: MemberSort): "asc" | "desc" | null {
    if (column === "email") return sort === "email-asc" ? "asc" : sort === "email-desc" ? "desc" : null;
    if (column === "source") return sort === "source-asc" ? "asc" : sort === "source-desc" ? "desc" : null;
    return sort === "added-asc" ? "asc" : sort === "added-desc" ? "desc" : null;
}

function memberSortValueFor(column: MemberSortColumn, direction: "asc" | "desc"): MemberSort {
    if (column === "email") return direction === "asc" ? "email-asc" : "email-desc";
    if (column === "source") return direction === "asc" ? "source-asc" : "source-desc";
    return direction === "asc" ? "added-asc" : "added-desc";
}

function SortIndicator({ direction }: { readonly direction: "asc" | "desc" | null }) {
    if (direction === "asc") return <ArrowUp aria-hidden="true" className="h-3 w-3" />;
    if (direction === "desc") return <ArrowDown aria-hidden="true" className="h-3 w-3" />;
    return <ChevronsUpDown aria-hidden="true" className="h-3 w-3 opacity-50" />;
}

function SortableHead({
    column,
    label,
    sort,
    onSort,
    className,
}: {
    readonly column: MemberSortColumn;
    readonly label: string;
    readonly sort: MemberSort;
    readonly onSort: (column: MemberSortColumn) => void;
    readonly className?: string;
}) {
    const direction = memberColumnDirection(column, sort);
    return (
        <TableHead
            aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
            className={className}
        >
            <button
                className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
                type="button"
                onClick={() => onSort(column)}
            >
                {label}
                <SortIndicator direction={direction} />
            </button>
        </TableHead>
    );
}

function GroupDetail({
    row,
    onBack,
    onEdit,
    onDelete,
    onChanged,
}: {
    readonly row: MsGroupRow;
    readonly onBack: () => void;
    readonly onEdit: (row: MsGroupRow) => void;
    readonly onDelete: (row: MsGroupRow) => void;
    readonly onChanged: () => void;
}) {
    const [memberSort, setMemberSort] = useState<MemberSort>("added-desc");
    const {
        data: members,
        total: memberTotal,
        page: memberPage,
        totalPages: memberTotalPages,
        isLoading,
        error,
        refresh,
        setPage: setMemberPage,
        resetPage: resetMemberPage,
    } = useMsGroupMembers(row.id, memberSort);
    const [addOpen, setAddOpen] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<MsGroupMemberRow | null>(null);
    const [removeBusy, setRemoveBusy] = useState(false);
    const [memberNotice, setMemberNotice] = useState<GroupNotice | null>(null);
    const [resync, setResync] = useState<MsGroupResyncResult | null>(null);
    const [resyncBusy, setResyncBusy] = useState(false);
    const [resyncError, setResyncError] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(() => new Set());
    const [selectAllMatching, setSelectAllMatching] = useState(false);
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
    const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false);

    const active = rowIsActive(row);
    const pageRows = useMemo(() => members ?? [], [members]);
    const pageSelectedCount = pageRows.filter((member) => selectedIds.has(member.id)).length;
    const allPageSelected = pageRows.length > 0 && pageSelectedCount === pageRows.length;
    const somePageSelected = pageSelectedCount > 0 && !allPageSelected;
    const selectedCount = selectAllMatching ? memberTotal : selectedIds.size;
    const showPageBanner = !selectAllMatching && allPageSelected;
    const canEscalate = memberTotal > pageRows.length;

    const dismissMemberNotice = useCallback(() => setMemberNotice(null), []);

    useEffect(() => {
        if (!resync) return;
        const timer = window.setTimeout(() => setResync(null), MS_NOTICE_AUTO_DISMISS_MS);
        return () => window.clearTimeout(timer);
    }, [resync]);

    const handleMembersSaved = async (result: MsAddGroupMembersResult): Promise<void> => {
        const parts: string[] = [];
        if (result.added.length > 0) parts.push(`${result.added.length} member${result.added.length === 1 ? "" : "s"} added`);
        if (result.skipped.length > 0) parts.push(`${result.skipped.length} skipped (already in this group or without a usable email)`);
        setMemberNotice({ tone: "info", text: parts.length > 0 ? `${parts.join(", ")}.` : "Member list unchanged." });
        if (memberPage === 1) {
            await refresh();
        } else {
            resetMemberPage();
        }
        onChanged();
    };

    const handleRemoveConfirm = async (): Promise<void> => {
        if (!removeTarget) return;
        setRemoveBusy(true);
        try {
            await removeMsGroupMember(row.id, removeTarget.id);
            setSelectedIds((current) => {
                const next = new Set(current);
                next.delete(removeTarget.id);
                return next;
            });
            setRemoveTarget(null);
            setMemberNotice({ tone: "info", text: `${removeTarget.email} removed from ${row.group_name}.` });
            await refresh();
            onChanged();
        } catch (cause) {
            setMemberNotice({ tone: "error", text: cause instanceof Error ? cause.message : String(cause) });
            setRemoveTarget(null);
        } finally {
            setRemoveBusy(false);
        }
    };

    const toggleMember = (memberId: number): void => {
        const base = selectAllMatching ? new Set(pageRows.map((member) => member.id)) : new Set(selectedIds);
        setSelectAllMatching(false);
        if (base.has(memberId)) {
            base.delete(memberId);
        } else {
            base.add(memberId);
        }
        setSelectedIds(base);
    };

    const toggleAllOnPage = (): void => {
        if (selectAllMatching) {
            setSelectAllMatching(false);
            setSelectedIds(new Set());
            return;
        }
        setSelectedIds((current) => {
            const next = new Set(current);
            const everySelected = pageRows.length > 0 && pageRows.every((member) => current.has(member.id));
            for (const member of pageRows) {
                if (everySelected) {
                    next.delete(member.id);
                } else {
                    next.add(member.id);
                }
            }
            return next;
        });
    };

    const handleSelectAllMatching = (): void => setSelectAllMatching(true);

    const handleReturnToPageSelection = (): void => {
        setSelectAllMatching(false);
        setSelectedIds(new Set(pageRows.map((member) => member.id)));
    };

    const clearSelection = (): void => {
        setSelectAllMatching(false);
        setSelectedIds(new Set());
    };

    const toggleMemberSort = (column: MemberSortColumn): void => {
        const direction: "asc" | "desc" = memberColumnDirection(column, memberSort) === "asc" ? "desc" : "asc";
        setMemberSort(memberSortValueFor(column, direction));
        resetMemberPage();
    };

    const handleBulkDeleteConfirm = async (): Promise<void> => {
        const escalate = selectAllMatching;
        if (!escalate && selectedIds.size === 0) return;
        setBulkDeleteBusy(true);
        try {
            const result = await bulkRemoveMsGroupMembers(
                row.id,
                escalate ? { filter: {} } : { memberIds: Array.from(selectedIds) }
            );
            setBulkDeleteOpen(false);
            setSelectAllMatching(false);
            setSelectedIds(new Set());
            const removedCount = result.removed.length;
            const notFoundCount = result.notFound.length;
            const parts: string[] = [];
            if (removedCount > 0) parts.push(`${removedCount} member${removedCount === 1 ? "" : "s"} removed`);
            if (notFoundCount > 0) parts.push(`${notFoundCount} already gone`);
            setMemberNotice({
                tone: "info",
                text: parts.length > 0 ? `${parts.join(", ")}.` : "No members were removed.",
            });
            await refresh();
            onChanged();
        } catch (cause) {
            setMemberNotice({ tone: "error", text: cause instanceof Error ? cause.message : String(cause) });
            setBulkDeleteOpen(false);
        } finally {
            setBulkDeleteBusy(false);
        }
    };

    const handleResync = async (): Promise<void> => {
        setResyncBusy(true);
        setResyncError(null);
        try {
            setResync(await resyncMsGroup(row.id));
            await refresh();
            onChanged();
        } catch (cause) {
            setResyncError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setResyncBusy(false);
        }
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4" data-testid="group-detail">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="p-3 bg-primary/10 rounded-2xl text-primary">
                        <Users className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold tracking-tight" title={row.group_name}>
                            {row.group_name}
                        </h2>
                        {row.description && !descriptionRestatesName(row.group_name, row.description) ? (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground" title={row.description}>
                                {row.description}
                            </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            {active ? null : (
                                <Badge className={statusTone(active)} variant="outline">
                                    Inactive
                                </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">Created {formatPHT(row.created_at)}</span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button className="min-h-11 md:min-h-0" size="sm" variant="outline" onClick={onBack}>
                        Back to groups
                    </Button>
                    <Button className="min-h-11 md:min-h-0" size="sm" variant="outline" onClick={() => onEdit(row)}>
                        Edit
                    </Button>
                    <Button
                        className="min-h-11 bg-red-600 hover:bg-red-700 focus-visible:ring-red-600 md:min-h-0"
                        size="sm"
                        onClick={() => onDelete(row)}
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Button
                    aria-label="Re-sync members from source"
                    className="min-h-11 md:min-h-0"
                    disabled={resyncBusy}
                    size="sm"
                    variant="outline"
                    onClick={() => void handleResync()}
                >
                    {resyncBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                    Re-sync from source
                </Button>
                <Button className="min-h-11 md:min-h-0" size="sm" onClick={() => setAddOpen(true)}>
                    <UserPlus className="h-4 w-4" />
                    Add member
                </Button>
            </div>

            {resyncError ? (
                <div className="rounded-lg border border-destructive/40 bg-card p-4" data-testid="group-resync-error" role="alert">
                    <p className="text-sm text-destructive">{resyncError}</p>
                </div>
            ) : null}

            {resync ? (
                <div
                    className="flex items-start justify-between gap-3 rounded-lg border bg-card p-4"
                    data-testid="group-resync-result"
                    role="status"
                >
                    <div>
                        <p className="text-sm">
                            Re-sync finished: {resync.updated} updated, {resync.unchanged} unchanged, {resync.missing} missing from source.
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Updated members picked up a changed source email; unchanged members already match; missing members point at a
                            source record that no longer has an email.
                        </p>
                    </div>
                    <Button
                        aria-label="Dismiss re-sync result"
                        className="h-6 w-6 shrink-0"
                        size="icon"
                        type="button"
                        variant="ghost"
                        onClick={() => setResync(null)}
                    >
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ) : null}

            {memberNotice ? (
                <MsNotice notice={memberNotice} testId="group-member-notice" onDismiss={dismissMemberNotice} />
            ) : null}

            <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Members</h3>
                {members ? (
                    <span
                        className="rounded-full border bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground tabular-nums"
                        data-testid="group-member-count"
                    >
                        {memberTotal} member{memberTotal === 1 ? "" : "s"}
                    </span>
                ) : null}
            </div>

            {isLoading && !members ? (
                <div className="flex flex-col gap-2" data-testid="group-members-loading" role="status" aria-label="Loading members">
                    {[0, 1].map((index) => (
                        <div className="flex items-center gap-3 rounded-lg border bg-card p-3" key={index}>
                            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-3 w-1/4" />
                            </div>
                            <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                    ))}
                    <span className="sr-only">Loading members…</span>
                </div>
            ) : null}

            {error ? (
                <div className="rounded-lg border border-destructive/40 bg-card p-4" data-testid="group-members-error" role="alert">
                    <p className="text-sm text-destructive">{error}</p>
                    <Button className="mt-2 min-h-11 md:min-h-0" size="sm" variant="outline" onClick={() => void refresh()}>
                        Retry
                    </Button>
                </div>
            ) : null}

            {!isLoading && !error && memberTotal === 0 ? (
                <div
                    className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-12 text-center"
                    data-testid="group-members-empty"
                >
                    <UserPlus aria-hidden="true" className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No members yet.</p>
                    <Button className="min-h-11 md:min-h-0" size="sm" onClick={() => setAddOpen(true)}>
                        Add the first member
                    </Button>
                </div>
            ) : null}

            {members && members.length > 0 ? (
                <div className="flex flex-col gap-2" data-testid="group-members-toolbar">
                    {selectedCount > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <span
                                className="rounded-full border bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground tabular-nums"
                                data-testid="group-members-selected-count"
                            >
                                {selectedCount} selected
                            </span>
                            <Button
                                className="h-7 text-xs"
                                size="sm"
                                type="button"
                                variant="ghost"
                                onClick={clearSelection}
                            >
                                Clear selection
                            </Button>
                            <Button
                                aria-label={`Delete ${selectedCount} selected members`}
                                className="ms-auto min-h-11 bg-red-600 hover:bg-red-700 focus-visible:ring-red-600 md:min-h-0"
                                size="sm"
                                type="button"
                                onClick={() => setBulkDeleteOpen(true)}
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete selected ({selectedCount})
                            </Button>
                        </div>
                    ) : null}
                    {selectAllMatching ? (
                        <div
                            className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2"
                            data-testid="group-members-select-all-banner"
                            role="status"
                        >
                            <span className="text-xs">
                                All {memberTotal} member{memberTotal === 1 ? "" : "s"} matching this filter are selected.
                            </span>
                            <Button
                                className="h-7 text-xs"
                                size="sm"
                                type="button"
                                variant="ghost"
                                onClick={handleReturnToPageSelection}
                            >
                                Return to page selection
                            </Button>
                            <span className="text-[11px] text-muted-foreground">
                                Scope is the whole group; the count is re-derived from the server on every page load.
                            </span>
                        </div>
                    ) : showPageBanner ? (
                        <div
                            className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2"
                            data-testid="group-members-page-banner"
                            role="status"
                        >
                            <span className="text-xs">
                                All {pageRows.length} on this page are selected.
                            </span>
                            {canEscalate ? (
                                <Button
                                    className="h-7 text-xs"
                                    size="sm"
                                    type="button"
                                    variant="secondary"
                                    onClick={handleSelectAllMatching}
                                >
                                    Select all {memberTotal} matching this filter
                                </Button>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            ) : null}

            {members && members.length > 0 ? (
                <div
                    className="overflow-hidden rounded-lg border bg-card [&_[data-slot=table-container]]:max-h-[70vh] [&_[data-slot=table-container]]:overflow-auto"
                    data-testid="group-members-list"
                >
                    <Table className="table-fixed min-w-[48rem]">
                        <TableHeader className="sticky top-0 z-10 bg-card">
                            <TableRow>
                                <TableHead className="w-10">
                                    <Checkbox
                                        aria-label="Select all members on this page"
                                        checked={selectAllMatching ? true : allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                                        onCheckedChange={() => toggleAllOnPage()}
                                    />
                                </TableHead>
                                <SortableHead column="email" label="Email" sort={memberSort} onSort={toggleMemberSort} />
                                <SortableHead column="source" label="Source" sort={memberSort} onSort={toggleMemberSort} className="w-32" />
                                <SortableHead column="added" label="Added" sort={memberSort} onSort={toggleMemberSort} className="w-36" />
                                <TableHead className="w-12 text-right">
                                    <span className="sr-only">Actions</span>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {members.map((member) => {
                                return (
                                    <TableRow data-testid="group-member-row" key={member.id}>
                                        <TableCell>
                                            <Checkbox
                                                aria-label={`Select ${member.email}`}
                                                checked={selectAllMatching || selectedIds.has(member.id)}
                                                onCheckedChange={() => toggleMember(member.id)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <span className="block truncate text-sm font-medium" title={member.email}>
                                                {member.email}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className="border-border bg-muted text-muted-foreground" variant="outline">
                                                {sourceLabel(member.source_kind)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="whitespace-nowrap text-xs text-muted-foreground">
                                                {formatPHT(member.created_at)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                aria-label={`Remove ${member.email}`}
                                                className="h-8 w-8"
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => setRemoveTarget(member)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            ) : null}
            <MsPager page={memberPage} totalPages={memberTotalPages} onPage={setMemberPage} />

            <MemberDialog
                groupId={row.id}
                groupName={row.group_name}
                open={addOpen}
                onOpenChange={setAddOpen}
                existingMembers={members ?? []}
                onSaved={(result) => void handleMembersSaved(result)}
            />
            <MsConfirmDialog
                busy={removeBusy}
                busyLabel="Removing…"
                confirmLabel="Remove member"
                description={removeTarget ? `${removeTarget.email} will stop receiving mail sent to ${row.group_name}.` : "Remove this member?"}
                open={removeTarget !== null}
                title={removeTarget ? `Remove ${removeTarget.email}?` : "Remove this member?"}
                onConfirm={() => void handleRemoveConfirm()}
                onOpenChange={(open) => {
                    if (!open) setRemoveTarget(null);
                }}
            />
            <MsConfirmDialog
                busy={bulkDeleteBusy}
                busyLabel="Removing…"
                confirmLabel={`Remove ${selectedCount} member${selectedCount === 1 ? "" : "s"}`}
                description={
                    selectAllMatching
                        ? `All ${memberTotal} members matching the current filter will be permanently removed from ${row.group_name}. This cannot be undone.`
                        : selectedCount === 1
                          ? `1 selected member will be permanently removed from ${row.group_name}. This cannot be undone.`
                          : `${selectedCount} selected members will be permanently removed from ${row.group_name}. This cannot be undone.`
                }
                open={bulkDeleteOpen}
                title={
                    selectAllMatching
                        ? `Remove all ${memberTotal} matching members?`
                        : selectedCount === 1
                          ? "Remove 1 member?"
                          : `Remove ${selectedCount} members?`
                }
                onConfirm={() => void handleBulkDeleteConfirm()}
                onOpenChange={(open) => {
                    if (!open) setBulkDeleteOpen(false);
                }}
            />
        </div>
    );
}

export function GroupsPage() {
    const { groups, isLoading, error, refresh } = useMsGroupsContext();
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<GroupStatusFilter>("all");
    const [sort, setSort] = useState<GroupSort>("name");
    const [counts, setCounts] = useState<Record<number, number>>({});
    const [detailId, setDetailId] = useState<number | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [editingRow, setEditingRow] = useState<MsGroupRow | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<MsGroupRow | null>(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [notice, setNotice] = useState<GroupNotice | null>(null);
    const [retrying, setRetrying] = useState(false);

    const dismissNotice = useCallback(() => setNotice(null), []);

    useEffect(() => {
        if (!groups) return;
        let live = true;
        void (async () => {
            const pairs: number[][] = await Promise.all(
                groups.map(async (group) => {
                    try {
                        const result = await fetchMsGroupMembers(group.id, { page: 1, limit: 1 });
                        return [group.id, result.total];
                    } catch {
                        return [group.id, -1];
                    }
                })
            );
            if (!live) return;
            const next: Record<number, number> = {};
            for (const [id, count] of pairs) next[id] = count;
            setCounts(next);
        })();
        return () => {
            live = false;
        };
    }, [groups]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        const rows = (groups ?? []).filter((row) => {
            if (status === "active" && !rowIsActive(row)) return false;
            if (status === "inactive" && rowIsActive(row)) return false;
            if (!query) return true;
            return (
                row.group_name.toLowerCase().includes(query) ||
                row.group_key.toLowerCase().includes(query) ||
                (row.description ?? "").toLowerCase().includes(query)
            );
        });
        return [...rows].sort((a, b) => {
            if (sort === "recent") return (b.created_at ?? "").localeCompare(a.created_at ?? "") || b.id - a.id;
            return a.group_name.localeCompare(b.group_name);
        });
    }, [groups, search, status, sort]);

    const { page, totalPages, pageItems, setPage, resetPage } = useMsPagination(filtered.length);
    const visible = pageItems(filtered);
    const detail = detailId === null ? null : (groups ?? []).find((row) => row.id === detailId) ?? null;

    const handleRetry = async (): Promise<void> => {
        setRetrying(true);
        try {
            await refresh();
        } finally {
            setRetrying(false);
        }
    };

    const handleDeleteConfirm = async (): Promise<void> => {
        if (!deleteTarget) return;
        setDeleteBusy(true);
        try {
            const outcome = await deleteMsGroup(deleteTarget.id);
            if (detailId === deleteTarget.id) setDetailId(null);
            setEditingRow((current) => (current?.id === deleteTarget.id ? null : current));
            setDeleteTarget(null);
            setNotice({ tone: "info", text: outcome.message });
            await refresh();
        } catch (cause) {
            setNotice({ tone: "error", text: cause instanceof Error ? cause.message : String(cause) });
            setDeleteTarget(null);
        } finally {
            setDeleteBusy(false);
        }
    };

    return (
        <section aria-label="Groups" className="flex min-h-0 flex-1 flex-col gap-4">
            {detail ? (
                <GroupDetail
                    key={detail.id}
                    row={detail}
                    onBack={() => setDetailId(null)}
                    onEdit={setEditingRow}
                    onDelete={setDeleteTarget}
                    onChanged={() => void refresh()}
                />
            ) : (
                <>
                    <header className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                            <span className="p-3 bg-primary/10 rounded-2xl text-primary">
                                <Users className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                                <h1 className="text-lg font-semibold tracking-tight">Groups</h1>
                                <p className="text-sm text-muted-foreground">Mailing lists for studio sends — open one to manage members.</p>
                            </div>
                        </div>
                        <Button aria-label="New group" className="min-h-11 md:min-h-0" size="sm" onClick={() => setCreateOpen(true)}>
                            New group
                        </Button>
                    </header>

                    <div className="flex flex-wrap items-center gap-2">
                        <Input
                            aria-label="Search groups"
                            className="h-8 w-full text-xs sm:max-w-xs"
                            placeholder="Search name, key, or description…"
                            value={search}
                            onChange={(event) => {
                                setSearch(event.target.value);
                                resetPage();
                            }}
                        />
                        <Select
                            value={status}
                            onValueChange={(next) => {
                                setStatus(next as GroupStatusFilter);
                                resetPage();
                            }}
                        >
                            <SelectTrigger aria-label="Filter groups by status" className="h-8 max-w-[220px] text-xs" size="sm">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                                {STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={sort}
                            onValueChange={(next) => {
                                setSort(next as GroupSort);
                                resetPage();
                            }}
                        >
                            <SelectTrigger aria-label="Sort groups" className="h-8 max-w-[220px] text-xs" size="sm">
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
                            aria-label="Refresh groups"
                            className="min-h-11 md:min-h-0"
                            disabled={isLoading}
                            size="sm"
                            variant="outline"
                            onClick={() => void refresh()}
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            Refresh
                        </Button>
                        {groups ? (
                            <span
                                className="ms-auto rounded-full border bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground tabular-nums"
                                data-testid="groups-count"
                            >
                                {filtered.length} of {groups.length}
                            </span>
                        ) : null}
                    </div>

                    {notice ? (
                        <MsNotice notice={notice} testId="groups-notice" onDismiss={dismissNotice} />
                    ) : null}

                    {isLoading && !groups ? (
                        <div className="flex flex-col gap-2" data-testid="groups-loading" role="status" aria-label="Loading groups">
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
                            <span className="sr-only">Loading groups…</span>
                        </div>
                    ) : null}

                    {error ? (
                        <div className="rounded-lg border border-destructive/40 bg-card p-4" data-testid="groups-error" role="alert">
                            <p className="text-sm text-destructive">{error}</p>
                            <Button className="mt-2 min-h-11 md:min-h-0" disabled={retrying} size="sm" variant="outline" onClick={() => void handleRetry()}>
                                {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                Retry
                            </Button>
                        </div>
                    ) : null}

                    {!isLoading && !error && groups && groups.length === 0 ? (
                        <div
                            className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-16 text-center"
                            data-testid="groups-empty"
                        >
                            <Users aria-hidden="true" className="size-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">No groups yet.</p>
                            <Button className="min-h-11 md:min-h-0" size="sm" onClick={() => setCreateOpen(true)}>
                                Create the first group
                            </Button>
                        </div>
                    ) : null}

                    {!isLoading && !error && groups && groups.length > 0 && filtered.length === 0 ? (
                        <div
                            className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-16 text-center"
                            data-testid="groups-no-match"
                        >
                            <SearchX aria-hidden="true" className="size-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">No groups match “{search.trim()}”.</p>
                            <p className="text-xs text-muted-foreground">Try a different search.</p>
                        </div>
                    ) : null}

                    {visible.length > 0 ? (
                        <ul className="flex flex-col gap-2" data-testid="groups-list">
                            {visible.map((row) => {
                                const active = rowIsActive(row);
                                const count = counts[row.id];
                                return (
                                    <li
                                        className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors duration-150 hover:border-primary/40"
                                        data-testid="group-row"
                                        key={row.id}
                                    >
                                        <button
                                            aria-label={`Open members of ${row.group_name}`}
                                            className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
                                            type="button"
                                            onClick={() => {
                                                setNotice(null);
                                                setDetailId(row.id);
                                            }}
                                        >
                                            <span className="truncate text-sm font-medium" title={row.group_name}>
                                                {row.group_name}
                                            </span>
                                            <span className="truncate text-xs text-muted-foreground">
                                                {count === undefined || count < 0
                                                    ? "Member count unavailable"
                                                    : `${count} member${count === 1 ? "" : "s"}`}
                                                {" · "}Created {formatPHT(row.created_at)}
                                            </span>
                                        </button>
                                        <Badge className={statusTone(active)} variant="outline">
                                            {active ? "Active" : "Inactive"}
                                        </Badge>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    aria-label={`Actions for group ${row.group_name}`}
                                                    className="h-8 w-8 shrink-0"
                                                    size="icon"
                                                    variant="ghost"
                                                >
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-[180px]">
                                                <DropdownMenuItem onSelect={() => {
                                                    setNotice(null);
                                                    setDetailId(row.id);
                                                }}>
                                                    View members
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => setEditingRow(row)}>
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                                    onSelect={() => setDeleteTarget(row)}
                                                >
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : null}
                    <MsPager page={page} totalPages={totalPages} onPage={setPage} />
                </>
            )}

            <GroupDialog
                mode="create"
                open={createOpen}
                onOpenChange={setCreateOpen}
                row={null}
                onSaved={() => void refresh()}
            />
            {editingRow ? (
                <GroupDialog
                    mode="edit"
                    open={editingRow !== null}
                    onOpenChange={(open) => {
                        if (!open) setEditingRow(null);
                    }}
                    row={editingRow}
                    onSaved={() => void refresh()}
                />
            ) : null}
            <MsConfirmDialog
                busy={deleteBusy}
                busyLabel="Deleting…"
                confirmLabel="Delete group"
                description="Groups that still have members are deactivated instead of deleted; empty groups are deleted permanently."
                open={deleteTarget !== null}
                title={deleteTarget ? `Delete “${deleteTarget.group_name}”?` : "Delete this group?"}
                onConfirm={() => void handleDeleteConfirm()}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
            />
        </section>
    );
}
