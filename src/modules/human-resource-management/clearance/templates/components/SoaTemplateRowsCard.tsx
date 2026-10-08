"use client";

import { useMemo, useState } from "react";
import type { JSX } from "react";
import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    Layers,
    Pencil,
    Plus,
    Power,
    PowerOff,
    RefreshCw,
    Search,
    SearchX,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

import { useDialogTriggerFocus } from "../hooks/useDialogTriggerFocus";
import { useSoaTemplateRows } from "../hooks/useSoaTemplateRows";
import type { SoaRowCreateInput, SoaRowUpdateInput } from "../providers/soaTemplatesClient";
import { useSoaTemplatesFetch } from "../providers/soaTemplatesProvider";
import type { SoaTemplate, SoaTemplateRow } from "../types";
import { ListPager, SortSelect } from "./ListControls";
import { SoaTemplateRowDialog } from "./SoaTemplateRowDialog";

type RowSort = "position" | "label" | "status";

const ROW_SORT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
    { value: "position", label: "Position" },
    { value: "label", label: "Label (A–Z)" },
    { value: "status", label: "Status" },
];

const ICON_FOCUS_RING =
    "focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function SoaTemplateRowsCard(props: { template: SoaTemplate }): JSX.Element {
    const { template } = props;
    const { showInactive } = useSoaTemplatesFetch();
    const rows = useSoaTemplateRows(template.id, showInactive);

    const [search, setSearch] = useState("");
    const [sort, setSort] = useState<RowSort>("position");
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<SoaTemplateRow | null>(null);
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState<number | null>(null);

    const captureRowTrigger = useDialogTriggerFocus(dialogOpen);

    const query = search.trim().toLowerCase();
    const filtered = useMemo(() => {
        if (query === "") {
            return rows.data;
        }
        return rows.data.filter((row) => row.label.toLowerCase().includes(query));
    }, [rows.data, query]);

    const sorted = useMemo(() => {
        const next = [...filtered];
        if (sort === "label") {
            next.sort((a, b) => a.label.localeCompare(b.label));
        } else if (sort === "status") {
            next.sort(
                (a, b) => Number(b.is_active) - Number(a.is_active) || a.label.localeCompare(b.label)
            );
        }
        return next;
    }, [filtered, sort]);

    const canReorder = sort === "position";

    const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
    const safePage = Math.min(page, pageCount - 1);
    const visible = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);
    const rangeStart = sorted.length === 0 ? 0 : safePage * pageSize + 1;
    const rangeEnd = Math.min(sorted.length, safePage * pageSize + pageSize);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        setPage(0);
    };

    const handleSortChange = (value: string) => {
        if (value === "position" || value === "label" || value === "status") {
            setSort(value);
            setPage(0);
        }
    };

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setPage(0);
    };

    const openCreate = () => {
        captureRowTrigger();
        setEditing(null);
        setDialogOpen(true);
    };

    const openEdit = (row: SoaTemplateRow) => {
        captureRowTrigger();
        setEditing(row);
        setDialogOpen(true);
    };

    const handleCreate = (input: SoaRowCreateInput) => {
        setSaving(true);
        void rows
            .create(input)
            .then(() => {
                toast.success("SOA row created");
                setDialogOpen(false);
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Save failed"))
            .finally(() => setSaving(false));
    };

    const handleUpdate = (input: SoaRowUpdateInput) => {
        if (editing === null) {
            return;
        }
        const id = editing.id;
        setSaving(true);
        void rows
            .update(id, input)
            .then(() => {
                toast.success("SOA row updated");
                setDialogOpen(false);
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Save failed"))
            .finally(() => setSaving(false));
    };

    const handleToggleActive = (row: SoaTemplateRow) => {
        setBusyId(row.id);
        void rows
            .setActive(row.id, !row.is_active)
            .then(() => toast.success(row.is_active ? "SOA row deactivated" : "SOA row reactivated"))
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Update failed"))
            .finally(() => setBusyId(null));
    };

    const handleMove = (row: SoaTemplateRow, direction: -1 | 1) => {
        setBusyId(row.id);
        void rows
            .move(row.id, direction)
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Reorder failed"))
            .finally(() => setBusyId(null));
    };

    return (
        <Card className="min-w-0">
            <CardHeader className="shrink-0">
                <div className="min-w-0">
                    <CardTitle className="truncate" title={`Rows for ${template.title}`}>
                        Rows · {template.title}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground" aria-live="polite">
                        {rows.data.length} {rows.data.length === 1 ? "row" : "rows"} · each row prints as a DEPARTMENT group
                    </p>
                </div>
                <CardAction className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                        variant="outline"
                        size="icon-lg"
                        aria-label="Refresh SOA rows"
                        disabled={rows.isLoading}
                        onClick={() =>
                            void rows.refresh().catch((err: unknown) =>
                                toast.error(err instanceof Error ? err.message : "Refresh failed")
                            )
                        }
                        className={ICON_FOCUS_RING}
                    >
                        <RefreshCw className={cn("h-4 w-4", rows.isLoading && "animate-spin")} />
                    </Button>
                    <Button onClick={openCreate} size="sm">
                        <Plus className="h-4 w-4" />
                        New row
                    </Button>
                </CardAction>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => handleSearchChange(event.target.value)}
                            placeholder="Search rows…"
                            aria-label="Search SOA rows"
                            className="h-10 pl-9"
                        />
                    </div>
                    <SortSelect
                        label="Sort"
                        value={sort}
                        options={ROW_SORT_OPTIONS}
                        onChange={handleSortChange}
                    />
                </div>

                {rows.isError && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Could not load SOA rows</AlertTitle>
                        <AlertDescription>{rows.error?.message ?? "Fetch failed"}</AlertDescription>
                    </Alert>
                )}

                {rows.isLoading ? (
                    <div className="space-y-2" aria-label="Loading SOA rows">
                        {[0, 1, 2].map((index) => (
                            <Skeleton key={index} className="h-[64px] w-full rounded-xl" />
                        ))}
                    </div>
                ) : rows.data.length === 0 ? (
                    <Empty>
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <Layers aria-hidden="true" />
                            </EmptyMedia>
                            <EmptyTitle>No rows yet</EmptyTitle>
                            <EmptyDescription>
                                Add the first department group — a template with no active
                                rows cannot be assigned.
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Button size="sm" onClick={openCreate}>
                                <Plus className="h-4 w-4" aria-hidden="true" />
                                New row
                            </Button>
                        </EmptyContent>
                    </Empty>
                ) : visible.length === 0 ? (
                    <Empty>
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <SearchX aria-hidden="true" />
                            </EmptyMedia>
                            <EmptyTitle>No rows match the search</EmptyTitle>
                            <EmptyDescription>
                                Try a different term, or clear the search to see every row.
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Button variant="outline" size="sm" onClick={() => handleSearchChange("")}>
                                Clear search
                            </Button>
                        </EmptyContent>
                    </Empty>
                ) : (
                    <div className="min-w-0 space-y-4">
                        <ol className="grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-2">
                            {visible.map((row) => {
                                const busy = busyId === row.id;
                                const orderIndex = rows.data.findIndex((entry) => entry.id === row.id);
                                return (
                                    <li key={row.id} className="min-w-0 rounded-xl border p-4 transition-colors hover:bg-muted/40">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <span className="mt-0.5 w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground" aria-hidden="true">
                                                {orderIndex + 1}
                                            </span>
                                            <div className="min-w-0 flex-1 space-y-1.5">
                                                <p className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                                                    <span className="min-w-0 flex-1 truncate font-medium" title={row.label}>
                                                        {row.label}
                                                    </span>
                                                    {row.is_active ? null : (
                                                        <StatusBadge tone="neutral" className="shrink-0">Inactive</StatusBadge>
                                                    )}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon-lg"
                                                    aria-label={`Move ${row.label} up`}
                                                    title={canReorder ? undefined : "Reset sort to Position to reorder"}
                                                    disabled={busy || !canReorder || orderIndex <= 0}
                                                    onClick={() => handleMove(row, -1)}
                                                    className={ICON_FOCUS_RING}
                                                >
                                                    <ArrowUp className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-lg"
                                                    aria-label={`Move ${row.label} down`}
                                                    title={canReorder ? undefined : "Reset sort to Position to reorder"}
                                                    disabled={busy || !canReorder || orderIndex < 0 || orderIndex >= rows.data.length - 1}
                                                    onClick={() => handleMove(row, 1)}
                                                    className={ICON_FOCUS_RING}
                                                >
                                                    <ArrowDown className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-lg"
                                                    aria-label={`Edit SOA row ${row.label}`}
                                                    onClick={() => openEdit(row)}
                                                    className={ICON_FOCUS_RING}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-lg"
                                                    aria-label={row.is_active ? `Deactivate SOA row ${row.label}` : `Reactivate SOA row ${row.label}`}
                                                    disabled={busy}
                                                    onClick={() => handleToggleActive(row)}
                                                    className={ICON_FOCUS_RING}
                                                >
                                                    {row.is_active ? (
                                                        <PowerOff className="h-4 w-4" />
                                                    ) : (
                                                        <Power className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                        {sorted.length > pageSize && (
                            <ListPager
                                page={safePage}
                                pageCount={pageCount}
                                rangeStart={rangeStart}
                                rangeEnd={rangeEnd}
                                total={sorted.length}
                                pageSize={pageSize}
                                onPageChange={setPage}
                                onPageSizeChange={handlePageSizeChange}
                            />
                        )}
                    </div>
                )}
            </CardContent>

            <SoaTemplateRowDialog
                open={dialogOpen}
                row={editing}
                saving={saving}
                onClose={() => setDialogOpen(false)}
                onCreate={handleCreate}
                onUpdate={handleUpdate}
            />
        </Card>
    );
}
