"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { extractBannedVariables, type CampaignTestSendData } from "../providers/campaignsClient";
import { useDialogFocusReturn } from "../hooks/useDialogFocusReturn";

interface CampaignTestSendDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly campaign: MsCampaignRow | null;
    readonly busy: boolean;
    readonly result: CampaignTestSendData | null;
    readonly error: string | null;
    readonly onSend: (seeds: string[]) => Promise<void>;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SEEDS = 5;

function seedStatusLabel(status: string): string {
    if (status === "dry_run") return "Dry run";
    if (status === "sent") return "Sent";
    if (status === "skipped") return "Skipped";
    if (status === "failed") return "Failed";
    return status
        .split("_")
        .map((part) => (part === "" ? part : part[0].toUpperCase() + part.slice(1)))
        .join(" ");
}

export function CampaignTestSendDialog({
    open,
    onOpenChange,
    campaign,
    busy,
    result,
    error,
    onSend,
}: CampaignTestSendDialogProps) {
    const [seedInput, setSeedInput] = useState("");
    const [formError, setFormError] = useState<string | null>(null);
    const focusReturn = useDialogFocusReturn();

    const banned = result ? extractBannedVariables(result.warnings) : [];
    const isDryRun = result?.status === "dry_run";

    const handleSend = async (): Promise<void> => {
        setFormError(null);
        const seeds = seedInput
            .split(/[\s,;]+/)
            .map((entry) => entry.trim().toLowerCase())
            .filter((entry) => entry !== "");
        const unique = Array.from(new Set(seeds));
        if (unique.length === 0) {
            setFormError("Enter at least one seed address.");
            return;
        }
        if (unique.length > MAX_SEEDS) {
            setFormError(`At most ${MAX_SEEDS} seed addresses are allowed.`);
            return;
        }
        const bad = unique.find((entry) => !EMAIL_PATTERN.test(entry));
        if (bad) {
            setFormError(`“${bad}” is not a valid email address.`);
            return;
        }
        await onSend(unique);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="flex max-h-[85vh] w-[95vw] flex-col overflow-hidden rounded-2xl p-0 sm:max-w-[520px]"
                onCloseAutoFocus={focusReturn.onCloseAutoFocus}
                onOpenAutoFocus={focusReturn.onOpenAutoFocus}
            >
                <DialogHeader className="px-6 pt-6 text-left">
                    <DialogTitle>Test send — {campaign?.campaign_name ?? "campaign"}</DialogTitle>
                    <DialogDescription>Up to {MAX_SEEDS} seed addresses, separated by commas or new lines.</DialogDescription>
                </DialogHeader>
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="campaign-seeds">
                            Seed addresses <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            className="h-9 text-sm"
                            disabled={busy}
                            id="campaign-seeds"
                            inputMode="email"
                            placeholder="qa@example.com, lead@example.com"
                            value={seedInput}
                            onChange={(event) => setSeedInput(event.target.value)}
                        />
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
                    {result ? (
                        <div className="flex flex-col gap-2 rounded-lg border p-3" role="status" aria-label="Test send result">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={isDryRun ? "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400" : ""}>
                                    {isDryRun ? "Dry run — not sent" : seedStatusLabel(result.status)}
                                </Badge>
                                {isDryRun ? (
                                    <p className="text-xs text-muted-foreground">Recorded only — nothing was emailed.</p>
                                ) : null}
                            </div>
                            {banned.length > 0 ? (
                                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5" role="alert">
                                    <p className="text-xs font-semibold text-destructive">
                                        Blocked template variables: {banned.map((name) => `{{${name}}}`).join(", ")}
                                    </p>
                                    <p className="mt-0.5 text-[11px] leading-snug text-destructive/90">
                                        Bulk sends reject template tokens — remove them from the template before queuing.
                                    </p>
                                </div>
                            ) : null}
                            <ul className="flex flex-col gap-1">
                                {result.results.map((row) => (
                                    <li className="flex min-w-0 items-center gap-2 text-xs" key={row.email}>
                                        <span className="min-w-0 flex-1 truncate font-mono" title={row.email}>
                                            {row.email}
                                        </span>
                                        <span className="shrink-0 rounded-full border bg-muted px-2 py-0.5 text-[11px]">
                                            {seedStatusLabel(row.status)}
                                        </span>
                                        {row.reason ? (
                                            <span className="max-w-40 shrink-0 truncate text-[11px] text-muted-foreground" title={row.reason}>
                                                {row.reason}
                                            </span>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                </div>
                <DialogFooter className="flex-row justify-end gap-2 border-t bg-muted/20 px-6 py-4">
                    <Button className="min-h-11 md:min-h-0" disabled={busy} size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    <Button className="min-h-11 md:min-h-0" disabled={busy} size="sm" onClick={() => void handleSend()}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {busy ? "Sending…" : "Send test"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
