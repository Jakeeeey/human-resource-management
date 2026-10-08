"use client";

import Link from "next/link";
import { useState } from "react";
import type { JSX } from "react";
import { AlertCircle, Pencil, Power, PowerOff, RefreshCw, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";

import { useDialogTriggerFocus } from "../hooks/useDialogTriggerFocus";
import type { SoaTemplateCreateInput, SoaTemplateUpdateInput } from "../providers/soaTemplatesClient";
import { SoaTemplatesFetchProvider, useSoaTemplatesFetch } from "../providers/soaTemplatesProvider";
import { SoaTemplateDialog } from "./SoaTemplateDialog";
import { SoaTemplateRowsCard } from "./SoaTemplateRowsCard";
import { SoaTemplateToggleDialog } from "./SoaTemplateToggleDialog";

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

function SoaTemplateWorkspaceContent(props: { templateId: number }): JSX.Element {
    const { templateId } = props;
    const { templates, directory } = useSoaTemplatesFetch();

    const template = templates.data.find((row) => row.id === templateId) ?? null;

    const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
    const [templateSaving, setTemplateSaving] = useState(false);
    const [toggleOpen, setToggleOpen] = useState(false);
    const [toggleBusy, setToggleBusy] = useState(false);

    const captureTemplateTrigger = useDialogTriggerFocus(templateDialogOpen);
    const captureToggleTrigger = useDialogTriggerFocus(toggleOpen);

    const refreshing = templates.isLoading;

    const handleRefresh = () => {
        void templates.refresh().catch((err: unknown) =>
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

    const handleTemplateCreate = (input: SoaTemplateCreateInput) => {
        setTemplateSaving(true);
        void templates
            .create(input)
            .then(() => {
                toast.success("SOA template created");
                setTemplateDialogOpen(false);
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Save failed"))
            .finally(() => setTemplateSaving(false));
    };

    const handleTemplateUpdate = (input: SoaTemplateUpdateInput) => {
        setTemplateSaving(true);
        void templates
            .update(templateId, input)
            .then(() => {
                toast.success("SOA template updated");
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
                toast.success(template.is_active ? "SOA template deactivated" : "SOA template reactivated");
                setToggleOpen(false);
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Update failed"))
            .finally(() => setToggleBusy(false));
    };

    const title = template?.title ?? "SOA template workspace";

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
                            SOA template workspace
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="min-h-11 w-full sm:w-auto md:min-h-0"
                    >
                        <Link href={`/hrm/clearance/templates?tab=soa&selected=${templateId}`}>Back to templates</Link>
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
                    <AlertTitle>Could not load SOA template</AlertTitle>
                    <AlertDescription className="space-y-3">
                        <p>{templates.error?.message ?? "Fetch failed"}</p>
                        <span className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                                Retry
                            </Button>
                            <Button asChild variant="outline" size="sm">
                                <Link href="/hrm/clearance/templates?tab=soa">Back to templates</Link>
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
                            <Link href="/hrm/clearance/templates?tab=soa">Back to templates</Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : (
                <div className="space-y-6">
                    <Card>
                        <CardContent className="space-y-6 p-4 sm:p-6">
                            <div
                                className={
                                    template.description
                                        ? "flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
                                        : "flex flex-wrap items-center justify-end gap-2"
                                }
                            >
                                {template.description ? (
                                    <div className="min-w-0">
                                        <p className="text-sm text-muted-foreground">{template.description}</p>
                                    </div>
                                ) : null}
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
                                        Code
                                    </dt>
                                    <dd className="mt-1 truncate text-sm font-semibold tabular-nums" title={template.code}>
                                        {template.code}
                                    </dd>
                                    <dd className="mt-0.5 text-xs text-muted-foreground">
                                        Permanent — assignments snapshot this code
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

                    <SoaTemplateRowsCard template={template} />

                    <SoaTemplateDialog
                        open={templateDialogOpen}
                        template={template}
                        departments={directory.departments}
                        saving={templateSaving}
                        onClose={() => setTemplateDialogOpen(false)}
                        onCreate={handleTemplateCreate}
                        onUpdate={handleTemplateUpdate}
                    />

                    <SoaTemplateToggleDialog
                        open={toggleOpen}
                        template={template}
                        busy={toggleBusy}
                        onClose={() => setToggleOpen(false)}
                        onConfirm={handleConfirmTemplateToggle}
                    />
                </div>
            )}
        </div>
    );
}

export function SoaTemplateWorkspace(props: { templateId: number }): JSX.Element {
    const { templateId } = props;
    return (
        <SoaTemplatesFetchProvider>
            <SoaTemplateWorkspaceContent templateId={templateId} />
        </SoaTemplatesFetchProvider>
    );
}
