"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { ClipboardCheck, Printer, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { ClearanceFormSchema, type ClearanceForm } from "../types";
import { formatPHT } from "../utils/time";
import { useClearanceWorkspace } from "../hooks/useClearanceWorkspace";
import { useFormDocumentGate } from "../hooks/useFormDocumentGate";
import { useRequestSignatories } from "../hooks/useRequestSignatories";
import { ClearanceFormPrintDialog } from "./ClearanceFormPrintDialog";
import { SignatoryAssignmentCard } from "./SignatoryAssignmentCard";

const REQUEST_STATUS_LABELS: Record<string, string> = {
    pending: "Pending",
    in_progress: "In Progress",
    completed: "Completed",
};

function statusTone(status: string): StatusTone {
    if (status === "completed") return "success";
    if (status === "in_progress") return "info";
    return "neutral";
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

interface ClearanceWorkspaceProps {
    requestId: number;
    employeeName: string | null;
    onBack: () => void;
    onChanged: () => void;
    autoPrint?: boolean;
}

export function ClearanceWorkspace({
    requestId,
    employeeName,
    onBack,
    onChanged,
    autoPrint = false,
}: ClearanceWorkspaceProps): JSX.Element {
    const { detail, employeeName: resolvedName, isLoading, error, refresh } =
        useClearanceWorkspace(requestId, employeeName);
    const [form, setForm] = useState<ClearanceForm | null>(null);
    const [printOpen, setPrintOpen] = useState(false);
    const autoPrintSeenRef = useRef<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/hrm/clearance/form/by-request?request_id=${requestId}`, {
                    cache: "no-store",
                });
                if (!res.ok) return;
                const body: unknown = await res.json().catch(() => null);
                if (
                    typeof body !== "object" ||
                    body === null ||
                    (body as { success?: unknown }).success !== true
                ) {
                    return;
                }
                const parsed = ClearanceFormSchema.safeParse((body as { data?: unknown }).data);
                if (!parsed.success || cancelled) return;
                setForm(parsed.data);
                if (autoPrint && autoPrintSeenRef.current !== requestId) {
                    autoPrintSeenRef.current = requestId;
                    setPrintOpen(true);
                }
            } catch {
                return;
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [requestId, autoPrint]);

    const templateTitle = detail?.template_title_snapshot ?? "Unknown template";

    const documents = useFormDocumentGate(requestId, detail?.user_id ?? null);
    const issuedCount = documents.checklist?.issuedCount ?? 0;

    const {
        items,
        candidates,
        selections,
        setSelection,
        changedCount,
        isLoading: signatoriesLoading,
        error: signatoriesError,
        isSaving,
        refresh: refreshSignatories,
        save: saveSignatories,
    } = useRequestSignatories(requestId);

    const handleSave = useCallback(async () => {
        try {
            await saveSignatories();
            toast.success("Signatories saved");
            refresh();
            onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to save signatories");
        }
    }, [saveSignatories, refresh, onChanged]);

    const handleRefresh = useCallback(async () => {
        refresh();
        refreshSignatories();
        await documents.refresh();
        await Promise.resolve();
        onChanged();
    }, [refresh, refreshSignatories, documents, onChanged]);

    const handleIssued = useCallback(
        (issued: ClearanceForm) => {
            setForm(issued);
            void documents.refresh();
            onChanged();
        },
        [documents, onChanged]
    );

    const isCompleted = detail?.status === "completed";
    const saveDisabled = isSaving || signatoriesLoading || changedCount === 0 || isCompleted;

    return (
        <div className="mx-auto min-h-screen max-w-[1600px] space-y-6 p-2 sm:p-6 md:p-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                    <div className="shrink-0 rounded-2xl bg-primary/10 p-3">
                        <ClipboardCheck className="h-6 w-6 text-primary" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="line-clamp-2 text-2xl font-bold sm:text-4xl" title={resolvedName}>
                                {isLoading && !detail ? "Loading…" : resolvedName}
                            </h1>
                            {detail ? (
                                <StatusBadge tone={statusTone(detail.status)}>
                                    {REQUEST_STATUS_LABELS[detail.status] ?? detail.status}
                                </StatusBadge>
                            ) : null}
                        </div>
                    </div>
                </div>
                <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" className="min-h-11 w-full sm:w-auto md:min-h-0" onClick={onBack}>
                        Back to list
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11 w-full sm:w-auto md:min-h-0"
                        onClick={() => void handleRefresh()}
                        disabled={isLoading}
                        aria-label="Refresh workspace"
                        title="Refresh workspace"
                    >
                        <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                        Refresh
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11 w-full sm:w-auto md:min-h-0"
                        onClick={() => void handleSave()}
                        disabled={saveDisabled}
                        aria-label="Save signatories"
                        title="Save signatories"
                    >
                        <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                        {isSaving ? "Saving…" : changedCount > 0 ? `Save (${changedCount})` : "Save"}
                    </Button>
                    {form ? (
                        <Button
                            size="sm"
                            className="min-h-11 w-full sm:w-auto md:min-h-0"
                            onClick={() => setPrintOpen(true)}
                            aria-label="Print clearance form"
                            title="Print clearance form"
                        >
                            <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
                            Print
                        </Button>
                    ) : null}
                </div>
            </div>

            {isLoading && !detail ? (
                <WorkspaceSkeletons />
            ) : error || !detail ? (
                <Alert variant="destructive">
                    <AlertTitle>Workspace unavailable</AlertTitle>
                    <AlertDescription className="space-y-3">
                        <p>{error ?? "This workspace could not be loaded."}</p>
                        <Button variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={isLoading}>
                            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                            Retry
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : (
                <div className="space-y-6">
                    <Card>
                        <CardContent className="flex flex-col gap-4 p-4 sm:p-6 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0 flex-1 space-y-1">
                                <h2 className="text-xl font-semibold sm:text-2xl">
                                    {templateTitle}
                                </h2>
                                <dl className="space-y-1 pt-2 text-sm">
                                    <div className="flex items-center justify-between gap-2">
                                        <dt className="text-muted-foreground">Filed</dt>
                                        <dd className="font-medium tabular-nums">{formatPHT(detail.created_at)}</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <dt className="text-muted-foreground">Progress</dt>
                                        <dd className="font-medium tabular-nums">
                                            {issuedCount} of 3 issued
                                        </dd>
                                    </div>
                                </dl>
                                <div className="pt-2">
                                    <Progress
                                        value={Math.round((issuedCount / 3) * 100)}
                                        aria-label={`${issuedCount} of 3 issued`}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {isCompleted ? (
                        <Alert>
                            <AlertTitle>Completed</AlertTitle>
                            <AlertDescription>
                                This clearance is complete and read-only.
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    <SignatoryAssignmentCard
                        items={items}
                        candidates={candidates}
                        selections={selections}
                        onSelect={setSelection}
                        disabled={isSaving || isCompleted}
                        isLoading={signatoriesLoading}
                        error={signatoriesError}
                        onRetry={refreshSignatories}
                    />
                </div>
            )}

            {form ? (
                <ClearanceFormPrintDialog
                    form={form}
                    open={printOpen}
                    onOpenChange={setPrintOpen}
                    onIssued={handleIssued}
                />
            ) : null}
        </div>
    );
}
