"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { toast } from "sonner";
import { formatPHT } from "../utils/time";
import {
    CLEARANCE_ITEM_STATUS_LABELS,
    CLEARANCE_REQUEST_STATUS_LABELS,
    CLEARANCE_SIGNER_TYPE_LABELS,
    type ClearanceRequestStatus,
} from "../types";
import { useClearanceHubContext } from "../providers/ClearanceHubProvider";
import type { ClearanceHubCandidate, ClearanceHubItem, ClearanceHubRequest } from "../hooks/useClearanceHub";
import { ConfirmCompleteDialog } from "./ConfirmCompleteDialog";
import { EditItemDialog } from "./EditItemDialog";
import { ReplacePoolDialog } from "./ReplacePoolDialog";
import { UnlockItemDialog } from "./UnlockItemDialog";
import { useDialogTriggerFocus } from "../hooks/useDialogTriggerFocus";
import styles from "./hub-status.module.css";

interface ClearanceDetailPanelProps {
    requestId: number | null;
}

function statusTone(status: ClearanceRequestStatus): StatusTone {
    if (status === "completed") return "success";
    if (status === "in_progress") return "info";
    return "neutral";
}

export function ClearanceDetailPanel({ requestId }: ClearanceDetailPanelProps) {
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
    const [poolItem, setPoolItem] = useState<ClearanceHubItem | null>(null);
    const [unlockingItem, setUnlockingItem] = useState<ClearanceHubItem | null>(null);
    const [isUnlocking, setIsUnlocking] = useState(false);

    const captureConfirmTrigger = useDialogTriggerFocus(confirmOpen);
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
        if (requestId === null) {
            setDetail(null);
            setCandidatesByItem(new Map());
            setError(null);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const loaded = await fetchDetail(requestId);
            setDetail(loaded);
            const results = await Promise.allSettled(
                loaded.items.map(async (item) => ({ itemId: item.id, members: await fetchCandidates(item.id) }))
            );
            const perItem = new Map<number, ClearanceHubCandidate[]>();
            for (const result of results) {
                if (result.status === "fulfilled") perItem.set(result.value.itemId, result.value.members);
            }
            setCandidatesByItem(perItem);
        } catch (err) {
            setDetail(null);
            setCandidatesByItem(new Map());
            setError(err instanceof Error ? err.message : "Failed to load clearance request");
        } finally {
            setIsLoading(false);
        }
    }, [requestId, fetchDetail, fetchCandidates]);

    useEffect(() => {
        reloadDetail();
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

    const poolMembers = useMemo(() => {
        if (!poolItem) return [];
        return candidatesByItem.get(poolItem.id) ?? [];
    }, [candidatesByItem, poolItem]);

    const pendingLabels = useMemo(() => {
        if (!detail) return [];
        return detail.items.filter((item) => item.status !== "signed").map((item) => item.label_snapshot);
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

    const handleRetry = async () => {
        await reloadDetail();
        await refresh();
    };

    if (requestId === null) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Select a clearance to view its details.</p>
                </CardContent>
            </Card>
        );
    }

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-2/3" />
                </CardHeader>
                <CardContent className="space-y-2">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full" />
                    ))}
                </CardContent>
            </Card>
        );
    }

    if (error || !detail) {
        return (
            <Card>
                <CardContent className="space-y-4 pt-6">
                    <Alert variant="destructive">
                        <AlertDescription>{error ?? "Failed to load clearance request"}</AlertDescription>
                    </Alert>
                    <Button onClick={handleRetry} variant="outline">
                        Retry
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const isCompleted = detail.status === "completed";

    return (
        <>
            <Card>
                <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <CardTitle className="truncate" title={employeeName}>
                                {employeeName}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                {detail.template_title_snapshot ?? "Unknown template"}
                            </p>
                        </div>
                        <StatusBadge tone={statusTone(detail.status)} className={detail.status === "completed" ? styles.signed : styles.pending}>
                            {CLEARANCE_REQUEST_STATUS_LABELS[detail.status]}
                        </StatusBadge>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                        <span>
                            <span className="text-muted-foreground">Progress: </span>
                            <span className="font-medium">
                                {detail.signed_count} of {detail.total_count} signed
                            </span>
                        </span>
                        <span>
                            <span className="text-muted-foreground">Filed: </span>
                            <span className="font-medium">{formatPHT(detail.created_at)}</span>
                        </span>
                        <span>
                            <span className="text-muted-foreground">Confirmed: </span>
                            <span className="font-medium">{formatPHT(detail.confirmed_at)}</span>
                        </span>
                    </div>
                    {isCompleted ? (
                        <Alert>
                            <AlertDescription>
                                This clearance is completed and read-only. Corrections are handled on paper.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div>
                            <Button
                                data-clearance-confirm-trigger
                                onClick={() => { captureConfirmTrigger(); setConfirmOpen(true); }}
                            >
                                Confirm Complete
                            </Button>
                        </div>
                    )}
                </CardHeader>
                <CardContent className="space-y-3">
                    {detail.items.length === 0 && (
                        <p className="text-sm text-muted-foreground">No categories on this clearance.</p>
                    )}
                    {detail.items.map((item) => {
                        const expectedName =
                            item.expected_signer_user_id === null
                                ? "Not yet assigned"
                                : (namesById.get(item.expected_signer_user_id) ?? "Unknown signer");
                        const actualName =
                            item.signed_by_user_id === null
                                ? "Not yet signed"
                                : (namesById.get(item.signed_by_user_id) ?? "Unknown signer");
                        return (
                            <div key={item.id} className="rounded-md border p-4 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-medium">{item.label_snapshot}</p>
                                    <StatusBadge
                                        tone={item.status === "signed" ? "success" : "neutral"}
                                        className={item.status === "signed" ? styles.signed : styles.pending}
                                    >
                                        {CLEARANCE_ITEM_STATUS_LABELS[item.status === "signed" ? "signed" : "pending"]}
                                    </StatusBadge>
                                </div>
                                <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                                    <span>
                                        <span className="text-muted-foreground">Signer group: </span>
                                        {CLEARANCE_SIGNER_TYPE_LABELS[item.signer_type_snapshot]}
                                    </span>
                                    {item.department_name_snapshot && (
                                        <span>
                                            <span className="text-muted-foreground">Department: </span>
                                            {item.department_name_snapshot}
                                        </span>
                                    )}
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
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            <ConfirmCompleteDialog
                isOpen={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={handleConfirm}
                employeeName={employeeName}
                templateTitle={detail.template_title_snapshot ?? "Unknown template"}
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
    );
}
