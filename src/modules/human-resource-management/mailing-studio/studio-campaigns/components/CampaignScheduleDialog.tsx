"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { MsCampaignRow } from "../types";
import type { CampaignConfirmCounts } from "../providers/campaignsClient";
import { useDialogFocusReturn } from "../hooks/useDialogFocusReturn";
import { formatPHT, parseUtcInstant, phLocalToUtcIso } from "../utils/time";
import { CampaignVariablesNotice } from "./CampaignVariablesNotice";

interface CampaignScheduleDialogProps {
    readonly open: boolean;
    readonly onClose: () => void;
    readonly campaign: MsCampaignRow | null;
    readonly counts: CampaignConfirmCounts | null;
    readonly loadingCounts: boolean;
    readonly busy: boolean;
    readonly error: string | null;
    readonly onConfirm: (scheduledAt: string) => void;
}

function toLocalInput(value: Date): string {
    return value.toLocaleString("sv-SE", { timeZone: "Asia/Manila" }).replace(" ", "T").slice(0, 16);
}

function utcIsoToLocalInput(value: string | null): string {
    if (!value) return "";
    const instant = parseUtcInstant(value);
    if (!instant) return "";
    return toLocalInput(instant);
}

export function CampaignScheduleDialog({
    open,
    onClose,
    campaign,
    counts,
    loadingCounts,
    busy,
    error,
    onConfirm,
}: CampaignScheduleDialogProps) {
    const [value, setValue] = useState(() => (campaign?.scheduled_at ? utcIsoToLocalInput(campaign.scheduled_at) : ""));
    const [formError, setFormError] = useState<string | null>(null);
    const minValue = toLocalInput(new Date());
    const focusReturn = useDialogFocusReturn();
    const resolvedIso = value.trim() === "" ? null : phLocalToUtcIso(value.trim());
    const resolvedPht = resolvedIso ? formatPHT(resolvedIso) : null;
    const showSuppressed = (counts?.suppressedCount ?? 0) > 0;
    const showDuplicates = (counts?.duplicateCount ?? 0) > 0;
    const cardCount = 1 + (showSuppressed ? 1 : 0) + (showDuplicates ? 1 : 0);
    const gridColumns = cardCount === 3 ? "grid-cols-3" : cardCount === 2 ? "grid-cols-2" : "grid-cols-1";

    const handleConfirm = (): void => {
        setFormError(null);
        const trimmed = value.trim();
        if (trimmed === "") {
            setFormError("Pick a date and time for the send.");
            return;
        }
        const iso = phLocalToUtcIso(trimmed);
        if (!iso) {
            setFormError("That date and time is not valid — pick a future slot.");
            return;
        }
        if (new Date(iso).getTime() <= Date.now()) {
            setFormError("The scheduled time must be in the future.");
            return;
        }
        onConfirm(iso);
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent
                className="w-[95vw] rounded-2xl sm:max-w-[480px]"
                onCloseAutoFocus={focusReturn.onCloseAutoFocus}
                onOpenAutoFocus={focusReturn.onOpenAutoFocus}
            >
                <DialogHeader className="text-left">
                    <DialogTitle>Schedule send — {campaign?.campaign_name ?? "campaign"}</DialogTitle>
                    <DialogDescription>It sends automatically at the chosen time.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                    {campaign?.scheduled_at ? (
                        <p className="text-xs text-muted-foreground" role="status">
                            Currently scheduled for {formatPHT(campaign.scheduled_at)}.
                        </p>
                    ) : null}
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="campaign-scheduled-at">
                            Send at (Philippines time, UTC+8) <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            className="h-9 text-sm"
                            disabled={busy}
                            id="campaign-scheduled-at"
                            min={minValue}
                            type="datetime-local"
                            value={value}
                            onChange={(event) => setValue(event.target.value)}
                        />
                        {resolvedPht ? (
                            <p className="text-[11px] leading-snug text-muted-foreground">This resolves to {resolvedPht} (UTC+8).</p>
                        ) : null}
                    </div>
                    {loadingCounts ? (
                        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground" role="status">
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
                        <p className="py-2 text-sm text-muted-foreground">Audience counts are unavailable right now.</p>
                    )}
                    <CampaignVariablesNotice variables={counts?.bannedVariables ?? []} />
                    {formError ? (
                        <p className="text-sm text-destructive" role="alert">
                            {formError}
                        </p>
                    ) : null}
                    {error ? (
                        <p className="text-sm text-destructive" role="alert">
                            {error}
                        </p>
                    ) : null}
                </div>
                <DialogFooter className="flex-row justify-end gap-2">
                    <Button className="min-h-11 md:min-h-0" disabled={busy} size="sm" variant="outline" onClick={onClose}>
                        Not yet
                    </Button>
                    <Button className="min-h-11 md:min-h-0" disabled={busy || loadingCounts} size="sm" onClick={handleConfirm}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {busy ? "Scheduling…" : "Schedule send"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
