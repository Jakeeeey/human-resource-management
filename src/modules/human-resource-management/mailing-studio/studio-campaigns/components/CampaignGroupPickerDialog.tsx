"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { campaignOptionIsActive, previewCampaignGroup, type CampaignGroupOption } from "../providers/campaignsClient";

interface CampaignGroupPickerDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly groups: readonly CampaignGroupOption[];
    readonly selectedIds: readonly number[];
    readonly onToggle: (id: number) => void;
    readonly onSelectAll: (ids: readonly number[]) => void;
    readonly onClear: () => void;
    readonly disabled: boolean;
}

const CHUNK_SIZE = 20;

function matchesQuery(group: CampaignGroupOption, query: string): boolean {
    return group.group_name.toLowerCase().includes(query) || group.group_key.toLowerCase().includes(query);
}

function formatMemberCount(count: number | null | undefined): string {
    if (count === undefined) return "…";
    if (count === null) return "—";
    return `${count} member${count === 1 ? "" : "s"}`;
}

export function CampaignGroupPickerDialog({
    open,
    onOpenChange,
    groups,
    selectedIds,
    onToggle,
    onSelectAll,
    onClear,
    disabled,
}: CampaignGroupPickerDialogProps) {
    const [search, setSearch] = useState("");
    const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);
    const [counts, setCounts] = useState<ReadonlyMap<number, number | null>>(new Map());
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (query === "") return groups;
        return groups.filter((group) => matchesQuery(group, query));
    }, [groups, search]);

    const [prevGroups, setPrevGroups] = useState(groups);
    if (prevGroups !== groups) {
        setPrevGroups(groups);
        setVisibleCount(CHUNK_SIZE);
    }

    const visibleRows = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
    const hasMore = visibleRows.length < filtered.length;
    const countsPending = visibleRows.some((group) => !counts.has(group.id));
    const selectableFiltered = useMemo(
        () => filtered.filter((group) => campaignOptionIsActive(group.is_active)),
        [filtered]
    );
    const pendingSelectAll = useMemo(
        () => selectableFiltered.filter((group) => !selectedIds.includes(group.id)),
        [selectableFiltered, selectedIds]
    );
    const inactiveFilteredCount = filtered.length - selectableFiltered.length;

    useEffect(() => {
        const root = scrollRef.current;
        const sentinel = sentinelRef.current;
        if (!root || !sentinel) return undefined;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setVisibleCount((current) =>
                        current >= filtered.length ? current : Math.min(current + CHUNK_SIZE, filtered.length)
                    );
                }
            },
            { root, rootMargin: "160px" }
        );
        observer.observe(sentinel);
        return () => {
            observer.disconnect();
        };
    }, [filtered.length, hasMore]);

    useEffect(() => {
        let live = true;
        const missing = visibleRows.filter((group) => !counts.has(group.id));
        if (missing.length === 0) return undefined;
        void Promise.all(
            missing.map(async (group) => {
                try {
                    const preview = await previewCampaignGroup(group.id);
                    return { id: group.id, count: preview.recipientCount + preview.suppressedCount };
                } catch {
                    return { id: group.id, count: null };
                }
            })
        ).then((results) => {
            if (!live) return;
            setCounts((prev) => {
                const next = new Map(prev);
                for (const result of results) next.set(result.id, result.count);
                return next;
            });
        });
        return () => {
            live = false;
        };
    }, [visibleRows, counts]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] w-[95vw] flex-col overflow-hidden rounded-2xl p-0 sm:max-w-[600px]">
                <DialogHeader className="px-6 pt-6 text-left">
                    <DialogTitle>Select audience groups</DialogTitle>
                    <DialogDescription>
                        Search every group and scroll to load more. Inactive groups are flagged — they cannot be
                        queued.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-6 py-4">
                    <div className="relative shrink-0">
                        <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            aria-label="Search groups"
                            className="h-9 pl-8 text-sm"
                            disabled={disabled}
                            placeholder="Search name or key…"
                            value={search}
                            onChange={(event) => {
                                setSearch(event.target.value);
                                setVisibleCount(CHUNK_SIZE);
                            }}
                        />
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-2">
                        <p className="text-[11px] tabular-nums text-muted-foreground" role="status">
                            {filtered.length === 0
                                ? "No groups found."
                                : `${filtered.length} group${filtered.length === 1 ? "" : "s"}`}
                        </p>
                        {pendingSelectAll.length > 0 ? (
                            <Button
                                className="h-7 shrink-0 text-xs"
                                disabled={disabled}
                                size="sm"
                                type="button"
                                variant="secondary"
                                onClick={() => onSelectAll(pendingSelectAll.map((group) => group.id))}
                            >
                                <CheckCheck className="h-3.5 w-3.5" />
                                Select all {pendingSelectAll.length}
                            </Button>
                        ) : null}
                    </div>
                    {pendingSelectAll.length > 0 && inactiveFilteredCount > 0 ? (
                        <p className="shrink-0 text-[11px] leading-snug text-muted-foreground">
                            Inactive groups are left out of select-all — they cannot be queued.
                        </p>
                    ) : null}
                    <div
                        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto rounded-lg border p-2"
                        ref={scrollRef}
                    >
                        {visibleRows.length === 0 ? (
                            <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
                                <p className="text-sm text-muted-foreground">No groups match the current search.</p>
                                <p className="text-xs text-muted-foreground">Try a different name or key.</p>
                            </div>
                        ) : (
                            visibleRows.map((group) => {
                                const checked = selectedIds.includes(group.id);
                                const active = campaignOptionIsActive(group.is_active);
                                const count = counts.get(group.id);
                                return (
                                    <label
                                        className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-2 text-sm hover:bg-muted/60"
                                        key={group.id}
                                    >
                                        <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => onToggle(group.id)} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate font-medium" title={group.group_name}>
                                                {group.group_name}
                                            </span>
                                            <span className="block truncate font-mono text-[11px] text-muted-foreground" title={group.group_key}>
                                                {group.group_key} · {formatMemberCount(count)}
                                            </span>
                                        </span>
                                        {!active ? (
                                            <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                                                Inactive
                                            </span>
                                        ) : null}
                                    </label>
                                );
                            })
                        )}
                        {hasMore ? <div aria-hidden="true" className="h-1 shrink-0" ref={sentinelRef} /> : null}
                    </div>
                    {countsPending && visibleRows.length > 0 ? (
                        <p
                            className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground"
                            role="status"
                        >
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Updating counts…
                        </p>
                    ) : null}
                </div>
                <div className="flex shrink-0 flex-row items-center justify-between gap-2 border-t bg-muted/20 px-6 py-4">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground" role="status">
                            {selectedIds.length} selected
                        </span>
                        {selectedIds.length > 0 ? (
                            <Button className="min-h-11 md:min-h-0" disabled={disabled} size="sm" variant="ghost" onClick={onClear}>
                                Clear all
                            </Button>
                        ) : null}
                    </div>
                    <Button className="min-h-11 md:min-h-0" disabled={disabled} size="sm" onClick={() => onOpenChange(false)}>
                        {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Done
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
