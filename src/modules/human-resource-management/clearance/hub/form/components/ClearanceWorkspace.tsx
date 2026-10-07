"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { Printer, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClearanceFormSchema, type ClearanceForm } from "../types";
import { useClearanceWorkspace } from "../hooks/useClearanceWorkspace";
import { useFormDocumentGate } from "../hooks/useFormDocumentGate";
import { useRequestSignatories } from "../hooks/useRequestSignatories";
import { ClearanceFormPrintDialog } from "./ClearanceFormPrintDialog";
import { SignatoryAssignmentCard } from "./SignatoryAssignmentCard";

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
    onChanged,
    autoPrint = false,
}: ClearanceWorkspaceProps): JSX.Element {
    const { detail, isLoading, error, refresh } =
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

    const documents = useFormDocumentGate(requestId, detail?.user_id ?? null);

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

    const isCompleted = detail?.status === "completed";
    const saveDisabled = isSaving || signatoriesLoading || changedCount === 0 || isCompleted;

    return (
        <div className="mx-auto min-h-screen max-w-[1600px] space-y-6 p-2 sm:p-6 md:p-10">
            <div className="flex justify-end">
                <div className="flex shrink-0 gap-2">
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
                />
            ) : null}
        </div>
    );
}
