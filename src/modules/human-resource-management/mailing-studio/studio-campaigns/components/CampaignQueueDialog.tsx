"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import type { MsCampaignRow } from "../types";
import type { CampaignConfirmCounts } from "../providers/campaignsClient";
import { useDialogFocusReturn } from "../hooks/useDialogFocusReturn";
import { CampaignVariablesNotice } from "./CampaignVariablesNotice";

interface CampaignQueueDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly campaign: MsCampaignRow | null;
    readonly counts: CampaignConfirmCounts | null;
    readonly loadingCounts: boolean;
    readonly expanding: boolean;
    readonly error: string | null;
    readonly onConfirm: () => void;
}

export function CampaignQueueDialog({
    open,
    onOpenChange,
    campaign,
    counts,
    loadingCounts,
    expanding,
    error,
    onConfirm,
}: CampaignQueueDialogProps) {
    const focusReturn = useDialogFocusReturn();
    const showSuppressed = (counts?.suppressedCount ?? 0) > 0;
    const showDuplicates = (counts?.duplicateCount ?? 0) > 0;
    const cardCount = 1 + (showSuppressed ? 1 : 0) + (showDuplicates ? 1 : 0);
    const gridColumns = cardCount === 3 ? "grid-cols-3" : cardCount === 2 ? "grid-cols-2" : "grid-cols-1";
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="w-[95vw] rounded-2xl sm:max-w-[480px]"
                onCloseAutoFocus={focusReturn.onCloseAutoFocus}
                onOpenAutoFocus={focusReturn.onOpenAutoFocus}
            >
                <DialogHeader className="text-left">
                    <DialogTitle>Queue “{campaign?.campaign_name ?? "campaign"}”?</DialogTitle>
                    <DialogDescription>This cannot be undone once queued.</DialogDescription>
                </DialogHeader>
                {loadingCounts ? (
                    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground" role="status">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Counting recipients…
                    </div>
                ) : counts ? (
                    <div className="flex flex-col gap-3" role="status" aria-label="Audience counts">
                        <dl className={`grid ${gridColumns} gap-2 text-center`}>
                            <div className="rounded-lg border bg-emerald-500/10 px-2 py-3">
                                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Will receive</dt>
                                <dd className="text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                                    {counts.recipientCount}
                                </dd>
                            </div>
                            {showSuppressed ? (
                                <div className="rounded-lg border bg-muted px-2 py-3">
                                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Unsubscribed</dt>
                                    <dd className="text-xl font-semibold tabular-nums">{counts.suppressedCount}</dd>
                                </div>
                            ) : null}
                            {showDuplicates ? (
                                <div className="rounded-lg border bg-muted px-2 py-3">
                                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Duplicates</dt>
                                    <dd className="text-xl font-semibold tabular-nums">{counts.duplicateCount}</dd>
                                </div>
                            ) : null}
                        </dl>
                    </div>
                ) : (
                    <p className="py-4 text-sm text-muted-foreground">Audience counts are unavailable right now.</p>
                )}
                <CampaignVariablesNotice variables={counts?.bannedVariables ?? []} />
                {error ? (
                    <p className="text-sm text-destructive" role="alert">
                        {error}
                    </p>
                ) : null}
                <DialogFooter className="flex-row justify-end gap-2">
                    <Button className="min-h-11 md:min-h-0" disabled={expanding} size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                        Not yet
                    </Button>
                    <Button
                        className="min-h-11 md:min-h-0"
                        disabled={loadingCounts || expanding || !counts}
                        size="sm"
                        onClick={onConfirm}
                    >
                        {expanding ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {expanding ? "Queuing…" : "Queue emails"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
