"use client";

import { useState } from "react";
import type { JSX } from "react";
import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    ClipboardList,
    Pencil,
    Plus,
    Power,
    PowerOff,
    RefreshCw,
    Users,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { useCategoryPool } from "../hooks/useCategoryPool";
import { useDialogTriggerFocus } from "../hooks/useDialogTriggerFocus";
import { useTemplateCategories } from "../hooks/useTemplateCategories";
import {
    replaceCategorySignatories,
    type CategoryCreateInput,
    type CategoryUpdateInput,
} from "../providers/clearanceTemplatesClient";
import { useClearanceTemplatesFetch } from "../providers/clearanceTemplatesProvider";
import { CLEARANCE_SIGNER_TYPE_LABELS, type ClearanceCategory, type ClearanceTemplate } from "../types";
import { CategoryDialog } from "./CategoryDialog";
import { SignerPoolDialog } from "./SignerPoolDialog";

const ICON_FOCUS_RING =
    "focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function signerDetail(
    category: ClearanceCategory,
    departmentName: (id: number) => string,
    poolCount: number | undefined
): string {
    if (category.signer_type === "pool") {
        if (poolCount === undefined) {
            return "Signer pool";
        }
        return poolCount === 1 ? "Signer pool · 1 signer" : `Signer pool · ${poolCount} signers`;
    }
    if (category.signer_type === "named_department") {
        return category.department_id === null
            ? "Named department"
            : `Named department · ${departmentName(category.department_id)}`;
    }
    if (category.signer_type === "subject_department") {
        return "Subject department · resigning employee's own department";
    }
    return "All employees";
}

export function CategoriesPanel(props: {
    template: ClearanceTemplate | null;
    hiddenBySearch: boolean;
    onClearSearch: () => void;
}): JSX.Element {
    const { template, hiddenBySearch, onClearSearch } = props;
    const { directory, showInactive } = useClearanceTemplatesFetch();
    const categories = useTemplateCategories(template?.id ?? null, showInactive);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<ClearanceCategory | null>(null);
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [poolOpen, setPoolOpen] = useState(false);
    const [poolCategory, setPoolCategory] = useState<ClearanceCategory | null>(null);
    const [poolSaving, setPoolSaving] = useState(false);

    const captureFormTrigger = useDialogTriggerFocus(dialogOpen);
    const capturePoolTrigger = useDialogTriggerFocus(poolOpen);

    const poolCounts = categories.poolCounts;
    const poolMembers = categories.poolMembers;
    const pool = useCategoryPool(
        template?.id ?? null,
        poolCategory?.id ?? null,
        poolOpen && poolCategory?.signer_type === "pool"
    );

    if (template === null) {
        return (
            <Card className="min-w-0">
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                    <div className="p-3 bg-primary/10 rounded-2xl">
                        <ClipboardList className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-lg font-semibold">Select a template</p>
                    <p className="max-w-md text-sm text-muted-foreground">
                        Choose a template on the left to manage its clearance categories and signer pools.
                    </p>
                </CardContent>
            </Card>
        );
    }

    const openCreate = () => {
        captureFormTrigger();
        setEditing(null);
        setDialogOpen(true);
    };

    const openEdit = (row: ClearanceCategory) => {
        captureFormTrigger();
        setEditing(row);
        setDialogOpen(true);
    };

    const openPool = (row: ClearanceCategory) => {
        capturePoolTrigger();
        setPoolCategory(row);
        setPoolOpen(true);
    };

    const handleCreate = (input: CategoryCreateInput, poolUserIds: number[]) => {
        setSaving(true);
        void categories
            .create(input)
            .then((created) => {
                if (created.signer_type === "pool" && poolUserIds.length > 0) {
                    return replaceCategorySignatories(template.id, created.id, poolUserIds).then(() => created);
                }
                return created;
            })
            .then(() => {
                toast.success("Category created");
                setDialogOpen(false);
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Save failed"))
            .finally(() => setSaving(false));
    };

    const handleUpdate = (input: CategoryUpdateInput) => {
        if (editing === null) {
            return;
        }
        setSaving(true);
        void categories
            .update(editing.id, input)
            .then(() => {
                toast.success("Category updated");
                setDialogOpen(false);
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Save failed"))
            .finally(() => setSaving(false));
    };

    const handleToggleActive = (row: ClearanceCategory) => {
        setBusyId(row.id);
        void categories
            .setActive(row.id, !row.is_active)
            .then(() => toast.success(row.is_active ? "Category deactivated" : "Category reactivated"))
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Update failed"))
            .finally(() => setBusyId(null));
    };

    const handleMove = (row: ClearanceCategory, direction: -1 | 1) => {
        setBusyId(row.id);
        void categories
            .move(row.id, direction)
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Reorder failed"))
            .finally(() => setBusyId(null));
    };

    const handleSavePool = (userIds: number[]) => {
        setPoolSaving(true);
        void pool
            .replace(userIds)
            .then(() => {
                toast.success("Signer pool updated");
                setPoolOpen(false);
                void categories.refresh();
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Save failed"))
            .finally(() => setPoolSaving(false));
    };

    return (
        <Card className="min-w-0 lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100vh-5rem)] lg:flex-col lg:overflow-hidden">
            <CardHeader className="shrink-0 flex-row items-start justify-between gap-2">
                <div className="min-w-0">
                    <CardTitle className="truncate" title={template.title}>
                        {template.title}
                    </CardTitle>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5">
                        {template.is_active ? (
                            <Badge variant="default">Active</Badge>
                        ) : (
                            <Badge variant="outline">Inactive</Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                            {categories.data.length} {categories.data.length === 1 ? "category" : "categories"}
                        </span>
                    </p>
                    {template.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
                    )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <Button
                        variant="outline"
                        size="icon-lg"
                        aria-label="Refresh categories"
                        disabled={categories.isLoading}
                        onClick={() =>
                            void categories.refresh().catch((err: unknown) =>
                                toast.error(err instanceof Error ? err.message : "Refresh failed")
                            )
                        }
                        className={ICON_FOCUS_RING}
                    >
                        <RefreshCw className={cn("h-4 w-4", categories.isLoading && "animate-spin")} />
                    </Button>
                    <Button onClick={openCreate} size="sm">
                        <Plus className="h-4 w-4" />
                        New category
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                {hiddenBySearch && (
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed p-3">
                        <p className="min-w-0 text-sm text-muted-foreground">
                            This template is hidden by the current search.
                        </p>
                        <Button variant="outline" size="sm" onClick={onClearSearch} className="shrink-0">
                            Clear search
                        </Button>
                    </div>
                )}

                {categories.isError && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Could not load categories</AlertTitle>
                        <AlertDescription>{categories.error?.message ?? "Fetch failed"}</AlertDescription>
                    </Alert>
                )}

                {categories.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading categories…</p>
                ) : categories.data.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No categories yet. Add the first clearance category — a template with no active
                        categories cannot be assigned.
                    </p>
                ) : (
                    <ol className="min-w-0 space-y-2">
                        {categories.data.map((row, index) => {
                            const busy = busyId === row.id;
                            const members = poolMembers[row.id];
                            return (
                                <li key={row.id} className="min-w-0 rounded-xl border p-3 transition-colors hover:bg-muted/40">
                                    <div className="flex min-w-0 items-start gap-2">
                                        <span className="mt-0.5 w-6 shrink-0 text-center text-sm font-semibold text-muted-foreground">
                                            {index + 1}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="flex flex-wrap items-center gap-1.5">
                                                <span className="truncate font-medium" title={row.label}>
                                                    {row.label}
                                                </span>
                                                {!row.is_active && <Badge variant="outline">Inactive</Badge>}
                                            </p>
                                            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
                                                <Badge variant="secondary">
                                                    {CLEARANCE_SIGNER_TYPE_LABELS[row.signer_type]}
                                                </Badge>
                                                <span className="text-muted-foreground">
                                                    {signerDetail(row, directory.departmentName, poolCounts[row.id])}
                                                </span>
                                            </p>
                                            {row.signer_type === "pool" && (
                                                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
                                                    {members === undefined ? (
                                                        <span className="text-sm text-muted-foreground">
                                                            Loading signers…
                                                        </span>
                                                    ) : (
                                                        members.map((id) => (
                                                            <Badge
                                                                key={id}
                                                                variant="secondary"
                                                                className="min-w-0 max-w-[180px]"
                                                                title={directory.employeeName(id)}
                                                            >
                                                                <span className="truncate">
                                                                    {directory.employeeName(id)}
                                                                </span>
                                                            </Badge>
                                                        ))
                                                    )}
                                                    <Button
                                                        variant="outline"
                                                        size="xs"
                                                        onClick={() => openPool(row)}
                                                        className={cn("shrink-0", ICON_FOCUS_RING)}
                                                    >
                                                        Manage pool
                                                    </Button>
                                                </div>
                                            )}
                                            {row.instructions && (
                                                <p
                                                    className="mt-1 truncate text-sm text-muted-foreground"
                                                    title={row.instructions}
                                                >
                                                    {row.instructions}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon-lg"
                                                aria-label={`Move ${row.label} up`}
                                                disabled={busy || index === 0}
                                                onClick={() => handleMove(row, -1)}
                                                className={ICON_FOCUS_RING}
                                            >
                                                <ArrowUp className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-lg"
                                                aria-label={`Move ${row.label} down`}
                                                disabled={busy || index === categories.data.length - 1}
                                                onClick={() => handleMove(row, 1)}
                                                className={ICON_FOCUS_RING}
                                            >
                                                <ArrowDown className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-lg"
                                                aria-label={`Edit category ${row.label}`}
                                                onClick={() => openEdit(row)}
                                                className={ICON_FOCUS_RING}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            {row.signer_type === "pool" && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon-lg"
                                                    aria-label={`Edit signer pool for ${row.label}`}
                                                    onClick={() => openPool(row)}
                                                    className={ICON_FOCUS_RING}
                                                >
                                                    <Users className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon-lg"
                                                aria-label={row.is_active ? `Deactivate category ${row.label}` : `Reactivate category ${row.label}`}
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
                )}
            </CardContent>

            <CategoryDialog
                open={dialogOpen}
                category={editing}
                departments={directory.departments}
                employees={directory.employees}
                employeeName={directory.employeeName}
                saving={saving}
                onClose={() => setDialogOpen(false)}
                onCreate={handleCreate}
                onUpdate={handleUpdate}
            />

            <SignerPoolDialog
                open={poolOpen}
                category={poolCategory}
                employees={directory.employees}
                initialUserIds={pool.userIds}
                loadingPool={pool.isLoading}
                saving={poolSaving}
                onClose={() => setPoolOpen(false)}
                onSave={handleSavePool}
                employeeName={directory.employeeName}
            />
        </Card>
    );
}
