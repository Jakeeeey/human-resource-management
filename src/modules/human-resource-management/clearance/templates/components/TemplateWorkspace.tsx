"use client";

import Link from "next/link";
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
    Settings2,
    Users,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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

import { useCategoryPool } from "../hooks/useCategoryPool";
import { useDialogTriggerFocus } from "../hooks/useDialogTriggerFocus";
import { useTemplateCategories } from "../hooks/useTemplateCategories";
import {
    replaceCategorySignatories,
    type CategoryCreateInput,
    type CategoryUpdateInput,
    type TemplateCreateInput,
    type TemplateUpdateInput,
} from "../providers/clearanceTemplatesClient";
import { ClearanceTemplatesFetchProvider, useClearanceTemplatesFetch } from "../providers/clearanceTemplatesProvider";
import { CLEARANCE_SIGNER_TYPE_LABELS, type ClearanceCategory } from "../types";
import { CategoryDialog } from "./CategoryDialog";
import { SignerPoolDialog } from "./SignerPoolDialog";
import { TemplateDialog } from "./TemplateDialog";
import { TemplateToggleDialog } from "./TemplateToggleDialog";

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

function poolPreview(
    members: readonly number[],
    employeeName: (id: number) => string
): { visible: string; full: string; extra: number } {
    const names = members.map((id) => employeeName(id));
    return {
        visible: names.slice(0, 3).join(", "),
        full: names.join(", "),
        extra: Math.max(0, names.length - 3),
    };
}

function WorkspaceSkeletons(): JSX.Element {
    return (
        <div className="space-y-6" aria-label="Loading workspace">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-96 w-full" />
        </div>
    );
}

function TemplateWorkspaceContent(props: { templateId: number }): JSX.Element {
    const { templateId } = props;
    const { templates, directory, showInactive, setShowInactive } = useClearanceTemplatesFetch();
    const categories = useTemplateCategories(templateId, showInactive);

    const template = templates.data.find((row) => row.id === templateId) ?? null;

    const [categorySearch, setCategorySearch] = useState("");
    const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
    const [templateSaving, setTemplateSaving] = useState(false);
    const [toggleOpen, setToggleOpen] = useState(false);
    const [toggleBusy, setToggleBusy] = useState(false);
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<ClearanceCategory | null>(null);
    const [categorySaving, setCategorySaving] = useState(false);
    const [busyCategoryId, setBusyCategoryId] = useState<number | null>(null);
    const [poolOpen, setPoolOpen] = useState(false);
    const [poolCategory, setPoolCategory] = useState<ClearanceCategory | null>(null);
    const [poolSaving, setPoolSaving] = useState(false);

    const captureTemplateTrigger = useDialogTriggerFocus(templateDialogOpen);
    const captureToggleTrigger = useDialogTriggerFocus(toggleOpen);
    const captureCategoryTrigger = useDialogTriggerFocus(categoryDialogOpen);
    const capturePoolTrigger = useDialogTriggerFocus(poolOpen);

    const poolCounts = categories.poolCounts;
    const poolMembers = categories.poolMembers;
    const pool = useCategoryPool(
        templateId,
        poolCategory?.id ?? null,
        poolOpen && poolCategory?.signer_type === "pool"
    );

    const categoryQuery = categorySearch.trim().toLowerCase();
    const visibleCategories = useMemo(() => {
        if (categoryQuery === "") {
            return categories.data;
        }
        return categories.data.filter((row) => row.label.toLowerCase().includes(categoryQuery));
    }, [categories.data, categoryQuery]);

    const refreshing = templates.isLoading || categories.isLoading;

    const poolCategoryCount = categories.data.filter((row) => row.signer_type === "pool").length;
    const totalPoolSigners = categories.data.reduce((sum, row) => {
        if (row.signer_type !== "pool") {
            return sum;
        }
        return sum + (poolCounts[row.id] ?? poolMembers[row.id]?.length ?? 0);
    }, 0);

    const handleRefresh = () => {
        void Promise.all([templates.refresh(), categories.refresh()]).catch((err: unknown) =>
            toast.error(err instanceof Error ? err.message : "Refresh failed")
        );
    };

    const openTemplateEdit = () => {
        captureTemplateTrigger();
        setTemplateDialogOpen(true);
    };

    const openTemplateToggle = () => {
        captureToggleTrigger();
        setToggleOpen(true);
    };

    const openCategoryCreate = () => {
        captureCategoryTrigger();
        setEditingCategory(null);
        setCategoryDialogOpen(true);
    };

    const openCategoryEdit = (row: ClearanceCategory) => {
        captureCategoryTrigger();
        setEditingCategory(row);
        setCategoryDialogOpen(true);
    };

    const openPool = (row: ClearanceCategory) => {
        capturePoolTrigger();
        setPoolCategory(row);
        setPoolOpen(true);
    };

    const handleTemplateCreate = (input: TemplateCreateInput) => {
        setTemplateSaving(true);
        void templates
            .create(input)
            .then(() => {
                toast.success("Template created");
                setTemplateDialogOpen(false);
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Save failed"))
            .finally(() => setTemplateSaving(false));
    };

    const handleTemplateUpdate = (input: TemplateUpdateInput) => {
        setTemplateSaving(true);
        void templates
            .update(templateId, input)
            .then(() => {
                toast.success("Template updated");
                setTemplateDialogOpen(false);
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Save failed"))
            .finally(() => setTemplateSaving(false));
    };

    const handleConfirmTemplateToggle = () => {
        if (template === null) {
            return;
        }
        setToggleBusy(true);
        void templates
            .setActive(template.id, !template.is_active)
            .then(() => {
                toast.success(template.is_active ? "Template deactivated" : "Template reactivated");
                setToggleOpen(false);
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Update failed"))
            .finally(() => setToggleBusy(false));
    };

    const handleCategoryCreate = (input: CategoryCreateInput, poolUserIds: number[]) => {
        setCategorySaving(true);
        void categories
            .create(input)
            .then((created) => {
                if (created.signer_type === "pool" && poolUserIds.length > 0) {
                    return replaceCategorySignatories(templateId, created.id, poolUserIds).then(() => created);
                }
                return created;
            })
            .then(() => {
                toast.success("Category created");
                setCategoryDialogOpen(false);
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Save failed"))
            .finally(() => setCategorySaving(false));
    };

    const handleCategoryUpdate = (input: CategoryUpdateInput) => {
        if (editingCategory === null) {
            return;
        }
        setCategorySaving(true);
        void categories
            .update(editingCategory.id, input)
            .then(() => {
                toast.success("Category updated");
                setCategoryDialogOpen(false);
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Save failed"))
            .finally(() => setCategorySaving(false));
    };

    const handleCategoryToggleActive = (row: ClearanceCategory) => {
        setBusyCategoryId(row.id);
        void categories
            .setActive(row.id, !row.is_active)
            .then(() => toast.success(row.is_active ? "Category deactivated" : "Category reactivated"))
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Update failed"))
            .finally(() => setBusyCategoryId(null));
    };

    const handleCategoryMove = (row: ClearanceCategory, direction: -1 | 1) => {
        setBusyCategoryId(row.id);
        void categories
            .move(row.id, direction)
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Reorder failed"))
            .finally(() => setBusyCategoryId(null));
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

    const title = template?.title ?? "Template workspace";

    return (
        <div className="mx-auto min-h-screen max-w-[1600px] space-y-6 p-2 sm:p-6 md:p-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                    <div className="shrink-0 rounded-2xl bg-primary/10 p-3">
                        <Settings2 className="h-6 w-6 text-primary" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="line-clamp-2 text-2xl font-bold sm:text-4xl" title={title}>
                                {title}
                            </h1>
                            {template ? (
                                template.is_active ? (
                                    <StatusBadge tone="success">Active</StatusBadge>
                                ) : (
                                    <StatusBadge tone="neutral">Inactive</StatusBadge>
                                )
                            ) : null}
                        </div>
                        <p className="text-base text-muted-foreground sm:text-lg">
                            Clearance template workspace
                        </p>
                    </div>
                </div>

                <div className="flex shrink-0 gap-2">
                    <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="min-h-11 w-full sm:w-auto md:min-h-0"
                    >
                        <Link href={`/hrm/clearance/templates?selected=${templateId}`}>Back to templates</Link>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11 w-full sm:w-auto md:min-h-0"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        aria-label="Refresh workspace"
                        title="Refresh workspace"
                    >
                        <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                        Refresh
                    </Button>
                </div>
            </div>

            {templates.isLoading && template === null ? (
                <WorkspaceSkeletons />
            ) : templates.isError && template === null ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Could not load template</AlertTitle>
                    <AlertDescription className="space-y-3">
                        <p>{templates.error?.message ?? "Fetch failed"}</p>
                        <span className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                                Retry
                            </Button>
                            <Button asChild variant="outline" size="sm">
                                <Link href="/hrm/clearance/templates">Back to templates</Link>
                            </Button>
                        </span>
                    </AlertDescription>
                </Alert>
            ) : template === null ? (
                <Alert>
                    <AlertTitle>Template unavailable</AlertTitle>
                    <AlertDescription className="space-y-3">
                        <p>This template could not be found. It may have been deleted.</p>
                        <Button asChild variant="outline" size="sm">
                            <Link href="/hrm/clearance/templates">Back to templates</Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : (
                <div className="space-y-6">
                    <Card>
                        <CardContent className="space-y-6 p-4 sm:p-6">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div className="min-w-0">
                                    {template.description ? (
                                        <p className="text-sm text-muted-foreground">{template.description}</p>
                                    ) : null}
                                </div>
                                <div className="flex shrink-0 flex-wrap items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={openTemplateEdit}>
                                        <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                                        Edit template
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={openTemplateToggle} disabled={toggleBusy}>
                                        {template.is_active ? (
                                            <PowerOff className="mr-2 h-4 w-4" aria-hidden="true" />
                                        ) : (
                                            <Power className="mr-2 h-4 w-4" aria-hidden="true" />
                                        )}
                                        {template.is_active ? "Deactivate" : "Reactivate"}
                                    </Button>
                                </div>
                            </div>
                            <dl className="grid grid-cols-2 gap-4 border-t pt-4 lg:grid-cols-3">
                                <div className="min-w-0">
                                    <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        Scope
                                    </dt>
                                    <dd className="mt-1 truncate text-sm font-semibold" title={template.department_id === null ? "Global template" : directory.departmentName(template.department_id)}>
                                        {template.department_id === null
                                            ? "Global"
                                            : directory.departmentName(template.department_id)}
                                    </dd>
                                    <dd className="mt-0.5 text-xs text-muted-foreground">
                                        {template.department_id === null
                                            ? "Applies to every department"
                                            : "Suggested when assigning"}
                                    </dd>
                                </div>
                                <div className="min-w-0">
                                    <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        Pool signers
                                    </dt>
                                    <dd className="mt-1 text-sm font-semibold tabular-nums">
                                        {totalPoolSigners} {totalPoolSigners === 1 ? "signer" : "signers"}
                                    </dd>
                                    <dd className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                                        Across {poolCategoryCount} {poolCategoryCount === 1 ? "pool" : "pools"}
                                    </dd>
                                </div>
                                <div className="min-w-0">
                                    <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        Status
                                    </dt>
                                    <dd className="mt-1 text-sm font-semibold">
                                        {template.is_active ? "Available for assignment" : "Hidden from assignment"}
                                    </dd>
                                </div>
                            </dl>
                        </CardContent>
                    </Card>

                    <Card className="min-w-0">
                        <CardHeader className="shrink-0 flex-row items-start justify-between gap-2">
                            <div className="min-w-0">
                                <CardTitle>Categories</CardTitle>
                                <p className="text-sm text-muted-foreground" aria-live="polite">
                                    {categories.data.length} {categories.data.length === 1 ? "category" : "categories"}
                                </p>
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
                                <Button onClick={openCategoryCreate} size="sm">
                                    <Plus className="h-4 w-4" />
                                    New category
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="min-w-0 space-y-4">
                            <div className="flex flex-col gap-3">
                                <div className="relative min-w-0">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={categorySearch}
                                        onChange={(event) => setCategorySearch(event.target.value)}
                                        placeholder="Search categories…"
                                        aria-label="Search categories"
                                        className="h-10 pl-9"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="clearance-workspace-show-inactive" className="cursor-pointer text-sm">
                                        Show inactive
                                    </Label>
                                    <Switch
                                        id="clearance-workspace-show-inactive"
                                        checked={showInactive}
                                        onCheckedChange={setShowInactive}
                                        className={ICON_FOCUS_RING}
                                    />
                                </div>
                            </div>

                            {categories.isError && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Could not load categories</AlertTitle>
                                    <AlertDescription>{categories.error?.message ?? "Fetch failed"}</AlertDescription>
                                </Alert>
                            )}

                            {categories.isLoading ? (
                                <div className="space-y-2" aria-label="Loading categories">
                                    {[0, 1, 2].map((index) => (
                                        <Skeleton key={index} className="h-[76px] w-full rounded-xl" />
                                    ))}
                                </div>
                            ) : categories.data.length === 0 ? (
                                <Empty>
                                    <EmptyHeader>
                                        <EmptyMedia variant="icon">
                                            <Layers aria-hidden="true" />
                                        </EmptyMedia>
                                        <EmptyTitle>No categories yet</EmptyTitle>
                                        <EmptyDescription>
                                            Add the first clearance category — a template with no active
                                            categories cannot be assigned.
                                        </EmptyDescription>
                                    </EmptyHeader>
                                    <EmptyContent>
                                        <Button size="sm" onClick={openCategoryCreate}>
                                            <Plus className="h-4 w-4" aria-hidden="true" />
                                            New category
                                        </Button>
                                    </EmptyContent>
                                </Empty>
                            ) : visibleCategories.length === 0 ? (
                                <Empty>
                                    <EmptyHeader>
                                        <EmptyMedia variant="icon">
                                            <SearchX aria-hidden="true" />
                                        </EmptyMedia>
                                        <EmptyTitle>No categories match the search</EmptyTitle>
                                        <EmptyDescription>
                                            Try a different term, or clear the search to see every category.
                                        </EmptyDescription>
                                    </EmptyHeader>
                                    <EmptyContent>
                                        <Button variant="outline" size="sm" onClick={() => setCategorySearch("")}>
                                            Clear search
                                        </Button>
                                    </EmptyContent>
                                </Empty>
                            ) : (
                                <ol className="grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-2">
                                    {visibleCategories.map((row, index) => {
                                        const busy = busyCategoryId === row.id;
                                        const members = poolMembers[row.id];
                                        const count = poolCounts[row.id];
                                        const detail = signerDetail(row, directory.departmentName, count);
                                        const preview = members === undefined ? null : poolPreview(members, directory.employeeName);
                                        return (
                                            <li key={row.id} className="min-w-0 rounded-xl border p-4 transition-colors hover:bg-muted/40">
                                                <div className="flex min-w-0 items-start gap-3">
                                                    <span className="mt-0.5 w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground" aria-hidden="true">
                                                        {index + 1}
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
                                                        <p className="flex min-w-0 items-center gap-1.5 overflow-hidden text-sm" title={row.signer_type === "pool" ? undefined : detail}>
                                                            <Badge variant="secondary" className="shrink-0">
                                                                {CLEARANCE_SIGNER_TYPE_LABELS[row.signer_type]}
                                                            </Badge>
                                                            {row.signer_type === "pool" ? (
                                                                members === undefined || count === undefined || preview === null ? (
                                                                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                                                                        Loading signers…
                                                                    </span>
                                                                ) : (
                                                                    <>
                                                                        <span className="shrink-0 text-muted-foreground tabular-nums">
                                                                            {count === 1 ? "1 signer" : `${count} signers`}
                                                                        </span>
                                                                        {members.length > 0 && (
                                                                            <>
                                                                                <span aria-hidden="true" className="shrink-0 text-muted-foreground/50">
                                                                                    ·
                                                                                </span>
                                                                                <span
                                                                                    className="min-w-0 flex-1 truncate text-muted-foreground"
                                                                                    title={preview.extra > 0 ? `${preview.full} (${count} signers)` : preview.full}
                                                                                >
                                                                                    {preview.visible}
                                                                                    {preview.extra > 0 ? ` +${preview.extra} more` : null}
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                    </>
                                                                )
                                                            ) : (
                                                                <span className="min-w-0 flex-1 truncate text-muted-foreground" title={detail}>
                                                                    {detail}
                                                                </span>
                                                            )}
                                                        </p>
                                                        {row.instructions && (
                                                            <p
                                                                className="truncate text-sm text-muted-foreground"
                                                                title={row.instructions}
                                                            >
                                                                {row.instructions}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-lg"
                                                            aria-label={`Move ${row.label} up`}
                                                            disabled={busy || index === 0}
                                                            onClick={() => handleCategoryMove(row, -1)}
                                                            className={ICON_FOCUS_RING}
                                                        >
                                                            <ArrowUp className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-lg"
                                                            aria-label={`Move ${row.label} down`}
                                                            disabled={busy || index === visibleCategories.length - 1}
                                                            onClick={() => handleCategoryMove(row, 1)}
                                                            className={ICON_FOCUS_RING}
                                                        >
                                                            <ArrowDown className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-lg"
                                                            aria-label={`Edit category ${row.label}`}
                                                            onClick={() => openCategoryEdit(row)}
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
                                                            onClick={() => handleCategoryToggleActive(row)}
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
                    </Card>

                    <TemplateDialog
                        open={templateDialogOpen}
                        template={template}
                        departments={directory.departments}
                        saving={templateSaving}
                        onClose={() => setTemplateDialogOpen(false)}
                        onCreate={handleTemplateCreate}
                        onUpdate={handleTemplateUpdate}
                    />

                    <TemplateToggleDialog
                        open={toggleOpen}
                        template={template}
                        busy={toggleBusy}
                        onClose={() => setToggleOpen(false)}
                        onConfirm={handleConfirmTemplateToggle}
                    />

                    <CategoryDialog
                        open={categoryDialogOpen}
                        category={editingCategory}
                        departments={directory.departments}
                        employees={directory.employees}
                        employeeName={directory.employeeName}
                        saving={categorySaving}
                        onClose={() => setCategoryDialogOpen(false)}
                        onCreate={handleCategoryCreate}
                        onUpdate={handleCategoryUpdate}
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
                </div>
            )}
        </div>
    );
}

export function TemplateWorkspace(props: { templateId: number }): JSX.Element {
    const { templateId } = props;
    return (
        <ClearanceTemplatesFetchProvider>
            <TemplateWorkspaceContent templateId={templateId} />
        </ClearanceTemplatesFetchProvider>
    );
}
