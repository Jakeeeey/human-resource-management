"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

import { useClearanceHubContext } from "../providers/ClearanceHubProvider";
import type { ClearanceHubCandidate, ClearanceHubItem, ClearanceHubRequest } from "../hooks/useClearanceHub";
import {
    CLEARANCE_ITEM_STATUS_LABELS,
    CLEARANCE_REQUEST_STATUS_LABELS,
    CLEARANCE_SIGNER_TYPE_LABELS,
    type ClearanceRequestStatus,
} from "../types";
import { formatPHT } from "../utils/time";
import { useDialogTriggerFocus } from "../hooks/useDialogTriggerFocus";
import { ConfirmCompleteDialog } from "./ConfirmCompleteDialog";
import { ClearancePrintDialog } from "./ClearancePrintDialog";
import { EditItemDialog } from "./EditItemDialog";
import { ReplacePoolDialog } from "./ReplacePoolDialog";
import { UnlockItemDialog } from "./UnlockItemDialog";
import {
    getFilingPrintable,
    type ClearancePrintable,
    type FilingDetail,
} from "../providers/clearanceFilingClient";
import styles from "./hub-status.module.css";

function statusTone(status: ClearanceRequestStatus): StatusTone {
    if (status === "completed") return "success";
    if (status === "in_progress") return "info";
    return "neutral";
}

function toFilingDetail(request: ClearanceHubRequest): FilingDetail {
    return {
        id: request.id,
        resignation_id: request.resignation_id,
        user_id: request.user_id,
        template_title_snapshot: request.template_title_snapshot,
        template_code_snapshot: null,
        status: request.status,
        created_at: request.created_at,
        confirmed_at: request.confirmed_at,
        items: request.items.map((item) => ({
            id: item.id,
            request_id: item.request_id,
            label_snapshot: item.label_snapshot,
            instructions_snapshot: item.instructions_snapshot,
            signer_type_snapshot: item.signer_type_snapshot,
            department_name_snapshot: item.department_name_snapshot,
            sort_order: item.sort_order,
            status: item.status === "signed" ? "signed" : "pending",
            expected_signer_user_id: item.expected_signer_user_id,
            signed_by_user_id: item.signed_by_user_id,
            substitution_reason: item.substitution_reason,
            remarks: item.remarks,
            signed_at: item.signed_at,
        })),
        signed_count: request.signed_count,
        total_count: request.total_count,
        cleared: request.cleared,
    };
}

function WorkspaceSkeletons() {
    return (
        <div className="space-y-6" aria-label="Loading workspace">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-96 w-full" />
        </div>
    );
}

export function ClearanceWorkspace({ requestId }: { requestId: number }) {
    const {
        resignations,
        refresh,
        fetchDetail,
        fetchCandidates,
        confirmRequest,
        unlockItem,
    } = useClearanceHubContext();

    const [detail, setDetail] = useState<ClearanceHubRequest | null>(null);
    const [candidatesByItem, setCandidatesByItem] = useState<Map<number, ClearanceHubCandidate[]>>(new Map());
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [editingItem, setEditingItem] = useState<ClearanceHubItem | null>(null);
    const [printable, setPrintable] = useState<ClearancePrintable | null>(null);
    const [printOpen, setPrintOpen] = useState(false);
    const [poolItem, setPoolItem] = useState<ClearanceHubItem | null>(null);
    const [unlockingItem, setUnlockingItem] = useState<ClearanceHubItem | null>(null);
    const [isUnlocking, setIsUnlocking] = useState(false);

    const captureConfirmTrigger = useDialogTriggerFocus(confirmOpen);
    const capturePrintTrigger = useDialogTriggerFocus(printOpen);
    const captureEditTrigger = useDialogTriggerFocus(editingItem !== null);
    const capturePoolTrigger = useDialogTriggerFocus(poolItem !== null);
    const captureUnlockTrigger = useDialogTriggerFocus(unlockingItem !== null);

    const handleConfirmCloseAutoFocus = useCallback((event: Event) => {
        const target = document.querySelector("[data-clearance-confirm-trigger]");
        if (target instanceof HTMLElement) {
            event.preventDefault();
            target.focus();
        }
    }, []);

    const reloadDetail = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const loaded = await fetchDetail(requestId);
            setDetail(loaded);
            const printablePending = getFilingPrintable(requestId).catch(() => null);
            const results = await Promise.allSettled(
                loaded.items.map(async (item) => ({ itemId: item.id, members: await fetchCandidates(item.id) }))
            );
            const perItem = new Map<number, ClearanceHubCandidate[]>();
            for (const result of results) {
                if (result.status === "fulfilled") perItem.set(result.value.itemId, result.value.members);
            }
            setCandidatesByItem(perItem);
            setPrintable(await printablePending);
        } catch (err) {
            setDetail(null);
            setPrintable(null);
            setCandidatesByItem(new Map());
            setError(err instanceof Error ? err.message : "Failed to load clearance request");
        } finally {
            setIsLoading(false);
        }
    }, [requestId, fetchDetail, fetchCandidates]);

    useEffect(() => {
        void reloadDetail();
    }, [reloadDetail]);

    const namesById = useMemo(() => {
        const map = new Map<number, string>();
        for (const members of candidatesByItem.values()) {
            for (const candidate of members) {
                if (!map.has(candidate.user_id)) map.set(candidate.user_id, candidate.full_name);
            }
        }
        return map;
    }, [candidatesByItem]);

    const employeeName = useMemo(() => {
        if (!detail) return "Unknown employee";
        const resignation = resignations.find((entry) => entry.id === detail.resignation_id);
        return resignation ? resignation.employee_name : "Unknown employee";
    }, [detail, resignations]);

    const templateTitle = detail?.template_title_snapshot ?? "Unknown template";

    const poolMembers = useMemo(() => {
        if (!poolItem) return [];
        return candidatesByItem.get(poolItem.id) ?? [];
    }, [candidatesByItem, poolItem]);

    const pendingLabels = useMemo(() => {
        if (!detail) return [];
        return detail.items.filter((item) => item.status !== "signed").map((item) => item.label_snapshot);
    }, [detail]);

    const pendingItems = useMemo(() => {
        if (!detail) return [];
        return detail.items.filter((item) => item.status !== "signed");
    }, [detail]);

    const signedItems = useMemo(() => {
        if (!detail) return [];
        return detail.items.filter((item) => item.status === "signed");
    }, [detail]);

    const handleConfirm = async () => {
        if (!detail) return;
        setIsConfirming(true);
        try {
            await confirmRequest(detail.id);
            toast.success("Clearance confirmed as complete");
            setConfirmOpen(false);
            await reloadDetail();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to confirm clearance");
        } finally {
            setIsConfirming(false);
        }
    };

    const handleUnlock = async (reason: string) => {
        if (!unlockingItem) return;
        setIsUnlocking(true);
        try {
            await unlockItem(unlockingItem.id, reason);
            toast.success("Category unlocked");
            setUnlockingItem(null);
            await reloadDetail();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to unlock clearance item");
        } finally {
            setIsUnlocking(false);
        }
    };

    const handleRefresh = async () => {
        await reloadDetail();
        await refresh();
    };

    const isCompleted = detail?.status === "completed";

    const renderItemCard = (item: ClearanceHubItem) => {
        const expectedName =
            item.expected_signer_user_id === null
                ? "Not yet assigned"
                : (namesById.get(item.expected_signer_user_id) ?? "Unknown signer");
        const actualName =
            item.signed_by_user_id === null
                ? "Not yet signed"
                : (namesById.get(item.signed_by_user_id) ?? "Unknown signer");
        return (
            <Card key={item.id}>
                <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <CardTitle className="truncate" title={item.label_snapshot}>
                                {item.label_snapshot}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                {CLEARANCE_SIGNER_TYPE_LABELS[item.signer_type_snapshot]}
                                {item.department_name_snapshot ? ` · ${item.department_name_snapshot}` : ""}
                            </p>
                        </div>
                        <StatusBadge
                            tone={item.status === "signed" ? "success" : "neutral"}
                            className={item.status === "signed" ? styles.signed : styles.pending}
                        >
                            {CLEARANCE_ITEM_STATUS_LABELS[item.status === "signed" ? "signed" : "pending"]}
                        </StatusBadge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                        <span>
                            <span className="text-muted-foreground">Expected signer: </span>
                            {expectedName}
                        </span>
                        <span>
                            <span className="text-muted-foreground">Signed by: </span>
                            {actualName}
                        </span>
                        <span>
                            <span className="text-muted-foreground">Signed on: </span>
                            {formatPHT(item.signed_at)}
                        </span>
                        {item.department_name_snapshot && (
                            <span>
                                <span className="text-muted-foreground">Department: </span>
                                {item.department_name_snapshot}
                            </span>
                        )}
                    </div>
                    {item.instructions_snapshot && (
                        <p className="text-sm text-muted-foreground">{item.instructions_snapshot}</p>
                    )}
                    {item.substitution_reason && (
                        <p className="text-sm bg-muted p-2 rounded">
                            <span className="text-muted-foreground">Substitution note: </span>
                            {item.substitution_reason}
                        </p>
                    )}
                    {item.remarks && (
                        <p className="text-sm bg-muted p-2 rounded">
                            <span className="text-muted-foreground">Employee note: </span>
                            {item.remarks}
                        </p>
                    )}
                    {!isCompleted && (
                        <div className="flex flex-wrap gap-2 pt-1">
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => { captureEditTrigger(); setEditingItem(item); }}
                            >
                                Edit
                            </Button>
                            {item.signer_type_snapshot === "pool" && item.status !== "signed" && (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => { capturePoolTrigger(); setPoolItem(item); }}
                                >
                                    Replace Pool
                                </Button>
                            )}
                            {item.status === "signed" && (
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => { captureUnlockTrigger(); setUnlockingItem(item); }}
                                >
                                    Unlock
                                </Button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="mx-auto min-h-screen max-w-[1600px] space-y-6 p-2 sm:p-6 md:p-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                    <div className="shrink-0 rounded-2xl bg-primary/10 p-3">
                        <ClipboardCheck className="h-6 w-6 text-primary" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="line-clamp-2 text-2xl font-bold sm:text-4xl" title={employeeName}>
                                {isLoading && !detail ? "Loading…" : employeeName}
                            </h1>
                            {detail ? (
                                <StatusBadge tone={statusTone(detail.status)} className={detail.status === "completed" ? styles.signed : styles.pending}>
                                    {CLEARANCE_REQUEST_STATUS_LABELS[detail.status]}
                                </StatusBadge>
                            ) : null}
                        </div>
                        <p className="text-base text-muted-foreground sm:text-lg">
                            Resignation clearance workspace
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 gap-2">
                    <Button asChild variant="outline" size="sm" className="min-h-11 w-full sm:w-auto md:min-h-0">
                        <Link href={`/hrm/clearance/hub?selected=${requestId}`}>Back to hub</Link>
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
                    {detail ? (
                        <Button
                            size="sm"
                            className="min-h-11 w-full sm:w-auto md:min-h-0"
                            onClick={() => { capturePrintTrigger(); setPrintOpen(true); }}
                            disabled={isLoading}
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
                                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                    Clearance request
                                </p>
                                <h2 className="text-xl font-semibold sm:text-2xl">
                                    {templateTitle}
                                </h2>
                                <dl className="space-y-1 pt-2 text-sm">
                                    <div className="flex items-center justify-between gap-2">
                                        <dt className="text-muted-foreground">Filed</dt>
                                        <dd className="font-medium tabular-nums">{formatPHT(detail.created_at)}</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <dt className="text-muted-foreground">Confirmed</dt>
                                        <dd className="font-medium tabular-nums">{formatPHT(detail.confirmed_at)}</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <dt className="text-muted-foreground">Progress</dt>
                                        <dd className="font-medium tabular-nums">
                                            {detail.signed_count} of {detail.total_count} signed
                                        </dd>
                                    </div>
                                </dl>
                                <div className="pt-2">
                                    <Progress
                                        value={
                                            detail.total_count > 0
                                                ? Math.round((detail.signed_count / detail.total_count) * 100)
                                                : 0
                                        }
                                        aria-label={`${detail.signed_count} of ${detail.total_count} signed`}
                                    />
                                </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-2 md:flex-col md:items-end">
                                <StatusBadge tone={detail.cleared ? "success" : "neutral"} className={detail.cleared ? styles.signed : styles.pending}>
                                    {detail.cleared ? "Cleared" : "Not cleared"}
                                </StatusBadge>
                            </div>
                        </CardContent>
                    </Card>

                    {isCompleted ? (
                        <Alert>
                            <AlertDescription>
                                This clearance is completed and read-only. Corrections are handled on paper.
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    {detail.items.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <p className="text-muted-foreground">No categories on this clearance.</p>
                            </CardContent>
                        </Card>
                    ) : null}

                    {pendingItems.length > 0 ? (
                        <section aria-label={`Needs signature — ${pendingItems.length} ${pendingItems.length === 1 ? "category" : "categories"}`} className="space-y-3">
                            <h3 className="text-sm font-semibold text-muted-foreground">
                                Needs signature ({pendingItems.length})
                            </h3>
                            <div className="grid gap-4 lg:grid-cols-2">
                                {pendingItems.map((item) => renderItemCard(item))}
                            </div>
                        </section>
                    ) : null}

                    {signedItems.length > 0 ? (
                        <section aria-label={`Signed — ${signedItems.length} ${signedItems.length === 1 ? "category" : "categories"}`} className="space-y-3">
                            <h3 className="text-sm font-semibold text-muted-foreground">
                                Signed ({signedItems.length})
                            </h3>
                            <div className="grid gap-4 lg:grid-cols-2">
                                {signedItems.map((item) => renderItemCard(item))}
                            </div>
                        </section>
                    ) : null}

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Next action</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isCompleted ? (
                                <div className="flex flex-wrap items-center gap-2">
                                    <StatusBadge tone="success" className={styles.signed}>
                                        Completed
                                    </StatusBadge>
                                    <span className="text-sm text-muted-foreground">
                                        No further action — this clearance is complete and read-only.
                                    </span>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-medium">Confirm this clearance as complete</span>
                                        <StatusBadge tone="neutral" className={styles.pending}>
                                            {pendingLabels.length === 0
                                                ? "Every category signed"
                                                : `${pendingLabels.length} unsigned`}
                                        </StatusBadge>
                                    </div>
                                    {pendingLabels.length > 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            The following categories are still unsigned: {pendingLabels.join(", ")}. Signatures
                                            collected on paper are never recorded in the system.
                                        </p>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            Every category is signed. Confirming closes this clearance as complete and makes
                                            the record read-only.
                                        </p>
                                    )}
                                    <div className="pt-1">
                                        <Button
                                            data-clearance-confirm-trigger
                                            size="sm"
                                            className="min-h-11 w-full sm:w-auto md:min-h-0"
                                            disabled={isConfirming}
                                            onClick={() => { captureConfirmTrigger(); setConfirmOpen(true); }}
                                        >
                                            Confirm Complete
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {detail ? (
                <>
                    <ClearancePrintDialog
                        detail={toFilingDetail(detail)}
                        printable={printable}
                        open={printOpen}
                        onOpenChange={setPrintOpen}
                    />
                    <ConfirmCompleteDialog
                        isOpen={confirmOpen}
                        onClose={() => setConfirmOpen(false)}
                        onConfirm={handleConfirm}
                        employeeName={employeeName}
                        templateTitle={templateTitle}
                        pendingLabels={pendingLabels}
                        isConfirming={isConfirming}
                        onCloseAutoFocus={handleConfirmCloseAutoFocus}
                    />
                    <EditItemDialog
                        isOpen={editingItem !== null}
                        onClose={() => setEditingItem(null)}
                        onSaved={reloadDetail}
                        item={editingItem}
                    />
                    <ReplacePoolDialog
                        isOpen={poolItem !== null}
                        onClose={() => setPoolItem(null)}
                        onSaved={reloadDetail}
                        requestId={detail.id}
                        itemId={poolItem?.id ?? null}
                        itemLabel={poolItem?.label_snapshot ?? ""}
                        members={poolMembers}
                    />
                    <UnlockItemDialog
                        isOpen={unlockingItem !== null}
                        onClose={() => setUnlockingItem(null)}
                        onConfirm={handleUnlock}
                        itemLabel={unlockingItem?.label_snapshot ?? ""}
                        isUnlocking={isUnlocking}
                    />
                </>
            ) : null}
        </div>
    );
}
