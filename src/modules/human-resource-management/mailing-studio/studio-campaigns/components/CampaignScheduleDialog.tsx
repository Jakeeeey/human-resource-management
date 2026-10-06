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
import { formatPHT, parseUtcInstant, phLocalToUtcIso } from "../utils/time";

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
            <DialogContent className="w-[95vw] rounded-2xl sm:max-w-[480px]">
                <DialogHeader className="text-left">
                    <DialogTitle>Schedule send — {campaign?.campaign_name ?? "campaign"}</DialogTitle>
                    <DialogDescription>
                        The campaign will be sent automatically at the chosen time. You can reschedule or unschedule it any time before it is queued.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                    {campaign?.scheduled_at ? (
                        <p className="text-xs text-muted-foreground" role="status">
                            Currently scheduled for {formatPHT(campaign.scheduled_at)}.
                        </p>
                    ) : null}
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="campaign-scheduled-at">
                            Send at <span className="text-destructive">*</span>
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
                    </div>
                    {loadingCounts ? (
                        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground" role="status">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Counting recipients…
                        </div>
                    ) : counts ? (
                        <div className="flex flex-col gap-3" role="status" aria-label="Audience counts">
                            <p className="text-sm font-medium">
                                {counts.recipientCount} will receive · {counts.suppressedCount} unsubscribed · {counts.duplicateCount} duplicates
                            </p>
                            <dl className="grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-lg border bg-emerald-500/10 px-2 py-3">
                                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Will receive</dt>
                                    <dd className="text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                                        {counts.recipientCount}
                                    </dd>
                                </div>
                                <div className="rounded-lg border bg-muted px-2 py-3">
                                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Unsubscribed</dt>
                                    <dd className="text-xl font-semibold tabular-nums">{counts.suppressedCount}</dd>
                                </div>
                                <div className="rounded-lg border bg-muted px-2 py-3">
                                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Duplicates</dt>
                                    <dd className="text-xl font-semibold tabular-nums">{counts.duplicateCount}</dd>
                                </div>
                            </dl>
                            <p className="text-xs leading-snug text-muted-foreground">
                                Unsubscribed addresses are skipped automatically. Duplicate memberships across groups collapse into one send each.
                            </p>
                        </div>
                    ) : (
                        <p className="py-2 text-sm text-muted-foreground">Audience counts are unavailable right now.</p>
                    )}
                    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5" role="alert">
                        <p className="text-xs font-semibold text-destructive">
                            Template variables are banned in bulk sends.
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-destructive/90">
                            Tokens such as {"{{name}}"} render blank in bulk mail — remove them from the template before scheduling.
                        </p>
                    </div>
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
