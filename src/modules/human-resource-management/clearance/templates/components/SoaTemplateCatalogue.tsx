"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { JSX } from "react";
import { AlertCircle, ChevronRight, LayoutTemplate, Pencil, Plus, Power, PowerOff, RefreshCw, Search, SearchX } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { useDialogTriggerFocus } from "../hooks/useDialogTriggerFocus";
import type { SoaTemplateCreateInput, SoaTemplateUpdateInput } from "../providers/soaTemplatesClient";
import { useSoaTemplatesFetch } from "../providers/soaTemplatesProvider";
import type { SoaTemplate } from "../types";
import { SoaTemplateDialog } from "./SoaTemplateDialog";
import { SoaTemplateToggleDialog } from "./SoaTemplateToggleDialog";

const PAGE_SIZE = 10;

const ICON_FOCUS_RING =
    "focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function SoaTemplateCatalogue(props: { selectedId: number | null }): JSX.Element {
    const { selectedId } = props;
    const { templates, directory, showInactive, setShowInactive } = useSoaTemplatesFetch();
    const router = useRouter();

    const [search, setSearch] = useState("");
    const [page, setPage] = useState(0);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<SoaTemplate | null>(null);
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [toggleRow, setToggleRow] = useState<SoaTemplate | null>(null);
    const [confirmBusy, setConfirmBusy] = useState(false);

    const captureFormTrigger = useDialogTriggerFocus(dialogOpen);
    const captureToggleTrigger = useDialogTriggerFocus(toggleRow !== null);

    const query = search.trim().toLowerCase();
    const filtered = useMemo(() => {
        if (query === "") {
            return templates.data;
        }
        return templates.data.filter((row) => row.title.toLowerCase().includes(query));
    }, [templates.data, query]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount - 1);
    const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
    const rangeStart = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
    const rangeEnd = Math.min(filtered.length, safePage * PAGE_SIZE + PAGE_SIZE);

    const countLabel =
        query === ""
            ? `${templates.data.length} ${templates.data.length === 1 ? "template" : "templates"}`
            : `${filtered.length} of ${templates.data.length} ${templates.data.length === 1 ? "template" : "templates"}`;

    const handleSearchChange = (value: string) => {
        setSearch(value);
        setPage(0);
    };

    const handleShowInactiveChange = (value: boolean) => {
        setShowInactive(value);
        setPage(0);
    };

    const openCreate = () => {
        captureFormTrigger();
        setEditing(null);
        setDialogOpen(true);
    };

    const openEdit = (row: SoaTemplate) => {
        captureFormTrigger();
        setEditing(row);
        setDialogOpen(true);
    };

    const requestToggle = (row: SoaTemplate) => {
        captureToggleTrigger();
        setToggleRow(row);
    };

    const handleCreate = (input: SoaTemplateCreateInput) => {
        setSaving(true);
        void templates
            .create(input)
            .then((created) => {
                toast.success("SOA template created");
                setDialogOpen(false);
                router.push(`/hrm/clearance/soa-templates/${created.id}`);
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Save failed"))
            .finally(() => setSaving(false));
    };

    const handleUpdate = (input: SoaTemplateUpdateInput) => {
        if (editing === null) {
            return;
        }
        const id = editing.id;
        setSaving(true);
        void templates
            .update(id, input)
            .then(() => {
                toast.success("SOA template updated");
                setDialogOpen(false);
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Save failed"))
            .finally(() => setSaving(false));
    };

    const handleConfirmToggle = () => {
        if (toggleRow === null) {
            return;
        }
        const row = toggleRow;
        setBusyId(row.id);
        setConfirmBusy(true);
        void templates
            .setActive(row.id, !row.is_active)
            .then(() => {
                toast.success(row.is_active ? "SOA template deactivated" : "SOA template reactivated");
                setToggleRow(null);
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Update failed"))
            .finally(() => {
                setBusyId(null);
                setConfirmBusy(false);
            });
    };

    return (
        <Card className="min-w-0">
            <CardHeader className="shrink-0 flex-row items-start justify-between gap-2">
                <div className="min-w-0">
                    <CardTitle>SOA Templates</CardTitle>
                    <p className="text-sm text-muted-foreground" aria-live="polite">
                        {countLabel}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon-lg"
                        aria-label="Refresh SOA templates"
                        disabled={templates.isLoading}
                        onClick={() => void templates.refresh().catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Refresh failed"))}
                        className={ICON_FOCUS_RING}
                    >
                        <RefreshCw className={cn("h-4 w-4", templates.isLoading && "animate-spin")} />
                    </Button>
                    <Button onClick={openCreate} size="sm">
                        <Plus className="h-4 w-4" />
                        New template
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4">
                <div className="flex flex-col gap-3">
                    <div className="relative min-w-0">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => handleSearchChange(event.target.value)}
                            placeholder="Search SOA templates…"
                            aria-label="Search SOA templates"
                            className="h-10 pl-9"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="soa-templates-show-inactive" className="cursor-pointer text-sm">
                            Show inactive
                        </Label>
                        <Switch
                            id="soa-templates-show-inactive"
                            checked={showInactive}
                            onCheckedChange={handleShowInactiveChange}
                            className={ICON_FOCUS_RING}
                        />
                    </div>
                </div>

                {templates.isError && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Could not load SOA templates</AlertTitle>
                        <AlertDescription>{templates.error?.message ?? "Fetch failed"}</AlertDescription>
                    </Alert>
                )}

                {templates.isLoading ? (
                    <div className="space-y-2" aria-label="Loading SOA templates">
                        {[0, 1, 2].map((index) => (
                            <Skeleton key={index} className="h-[76px] w-full rounded-xl" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    templates.data.length === 0 ? (
                        <Empty>
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <LayoutTemplate aria-hidden="true" />
                                </EmptyMedia>
                                <EmptyTitle>No SOA templates yet</EmptyTitle>
                                <EmptyDescription>
                                    Create the first SOA template.
                                </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent>
                                <Button size="sm" onClick={openCreate}>
                                    <Plus className="h-4 w-4" aria-hidden="true" />
                                    New template
                                </Button>
                            </EmptyContent>
                        </Empty>
                    ) : (
                        <Empty>
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <SearchX aria-hidden="true" />
                                </EmptyMedia>
                                <EmptyTitle>No SOA templates match the search</EmptyTitle>
                                <EmptyDescription>
                                    Try a different term, or clear the search to see every template.
                                </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent>
                                <Button variant="outline" size="sm" onClick={() => handleSearchChange("")}>
                                    Clear search
                                </Button>
                            </EmptyContent>
                        </Empty>
                    )
                ) : (
                    <div className="min-w-0 space-y-4">
                        <ul className="min-w-0 space-y-2">
                            {visible.map((row) => {
                                const isSelected = row.id === selectedId;
                                const busy = busyId === row.id;
                                return (
                                    <li
                                        key={row.id}
                                        aria-current={isSelected ? "true" : undefined}
                                        className={cn(
                                            "min-w-0 rounded-xl border transition-colors",
                                            isSelected
                                                ? "border-primary bg-primary/10 shadow-sm"
                                                : "hover:bg-muted"
                                        )}
                                    >
                                        <div className="flex min-w-0 items-center gap-3 p-4">
                                            <Link
                                                href={`/hrm/clearance/soa-templates/${row.id}`}
                                                aria-label={`Open SOA template ${row.title} workspace`}
                                                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                                            >
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate font-medium" title={row.title}>
                                                        {row.title}
                                                    </span>
                                                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                                                        {row.is_active ? (
                                                            <StatusBadge tone="success">Active</StatusBadge>
                                                        ) : (
                                                            <StatusBadge tone="neutral">Inactive</StatusBadge>
                                                        )}
                                                    </span>
                                                    <span className="mt-1 block truncate text-sm text-muted-foreground">
                                                        {row.department_id === null
                                                            ? "Global template"
                                                            : `Suggested for ${directory.departmentName(row.department_id)}`}
                                                    </span>
                                                </span>
                                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                            </Link>
                                            <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon-lg"
                                                    aria-label={`Edit SOA template ${row.title}`}
                                                    onClick={() => openEdit(row)}
                                                    className={ICON_FOCUS_RING}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-lg"
                                                    aria-label={row.is_active ? `Deactivate SOA template ${row.title}` : `Reactivate SOA template ${row.title}`}
                                                    disabled={busy}
                                                    onClick={() => requestToggle(row)}
                                                    className={ICON_FOCUS_RING}
                                                >
                                                    {row.is_active ? (
                                                        <PowerOff className="h-4 w-4" />
                                                    ) : (
                                                        <Power className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            </span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                        {filtered.length > PAGE_SIZE && (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-muted-foreground" aria-live="polite">
                                    Showing {rangeStart}–{rangeEnd} of {filtered.length}
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={safePage === 0}
                                        onClick={() => setPage(safePage - 1)}
                                    >
                                        Previous
                                    </Button>
                                    <span className="text-sm text-muted-foreground">
                                        Page {safePage + 1} of {pageCount}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={safePage >= pageCount - 1}
                                        onClick={() => setPage(safePage + 1)}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>

            <SoaTemplateDialog
                open={dialogOpen}
                template={editing}
                departments={directory.departments}
                saving={saving}
                onClose={() => setDialogOpen(false)}
                onCreate={handleCreate}
                onUpdate={handleUpdate}
            />

            <SoaTemplateToggleDialog
                open={toggleRow !== null}
                template={toggleRow}
                busy={confirmBusy}
                onClose={() => setToggleRow(null)}
                onConfirm={handleConfirmToggle}
            />
        </Card>
    );
}
