"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

import type { MailBindingRow } from "../providers/mailBindingService";
import {
    listSendNowApplicants,
    postManualSendNow,
    type SendNowApplicant,
} from "../providers/mailSendNowService";
import { MailCombobox } from "./MailCombobox";

interface MailSendNowDialogProps {
    // Invite binding the dialog was opened from (null = closed). The event
    // key is frozen server-side — the binding only gates WHICH row opened us.
    binding: MailBindingRow | null;
    onClose: () => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Manual Send-now applicant picker (mailing-module todo 12). Module-local
 * dialog: searches applicants via MailCombobox over the existing applicants
 * list shape (read-only), collects an optional to_email override, and fires
 * exactly ONE POST to /api/hrm/mailing/send-now per click — no count/bulk
 * parameter anywhere. The POST is never awaited in a render path: the click
 * handler owns a loading flag and surfaces dispatch's { ok, reason? } as a
 * toast.
 * @param binding - Invite binding row (null = closed).
 * @param onClose - Closes the dialog.
 * @returns The applicant-picker dialog.
 */
export function MailSendNowDialog({ binding, onClose }: MailSendNowDialogProps) {
    const open = binding !== null;

    const [applicants, setApplicants] = useState<SendNowApplicant[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [pickedId, setPickedId] = useState("");
    const [toEmail, setToEmail] = useState("");
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        setLoadError(null);
        setPickedId("");
        setToEmail("");
        (async () => {
            const result = await listSendNowApplicants();
            if (cancelled) return;
            if (!result.success || !result.data) {
                setLoadError(result.message ?? "Failed to list applicants");
            } else {
                setApplicants(result.data);
            }
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [open ]);

    const options = useMemo(
        () =>
            applicants.map((row) => ({
                value: String(row.application_id),
                label: `${row.full_name}${row.position_applied_for ? ` — ${row.position_applied_for}` : ""}`,
            })),
        [applicants]
    );

    const picked = useMemo(
        () => applicants.find((row) => String(row.application_id) === pickedId) ?? null,
        [applicants, pickedId]
    );

    const emailError =
        toEmail.trim().length > 0 && !EMAIL_PATTERN.test(toEmail.trim())
            ? "Enter a valid email, or leave blank to use the application record."
            : null;

    const handleSend = async () => {
        if (!picked || sending || emailError) return;
        setSending(true);
        try {
            const trimmed = toEmail.trim();
            const result = await postManualSendNow({
                application_id: picked.application_id,
                ...(trimmed.length > 0 ? { to_email: trimmed } : {}),
            });
            if (!result.success) {
                toast.error(result.message ?? "Send failed.");
                return;
            }
            if (result.data?.ok) {
                toast.success("Invite sent (logged to outbox).");
                onClose();
            } else {
                toast.error(`Not sent (${result.data?.reason ?? "unknown"}).`);
            }
        } finally {
            setSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Send final interview invite</DialogTitle>
                </DialogHeader>
                {loading ? (
                    <div className="grid gap-2">
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                ) : loadError ? (
                    <div className="grid gap-3">
                        <p className="text-sm text-destructive">{loadError}</p>
                        <Button
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => {
                                setLoading(true);
                                setLoadError(null);
                                void listSendNowApplicants().then((result) => {
                                    if (!result.success || !result.data) {
                                        setLoadError(result.message ?? "Failed to list applicants");
                                    } else {
                                        setApplicants(result.data);
                                    }
                                    setLoading(false);
                                });
                            }}
                        >
                            Retry
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        <div className="grid gap-1.5">
                            <Label>Applicant</Label>
                            <MailCombobox
                                options={options}
                                value={pickedId}
                                onValueChange={setPickedId}
                                placeholder="Search applicants…"
                                disabled={sending}
                            />
                        </div>
                        {picked && (
                            <p className="truncate text-sm text-muted-foreground" title={`Application #${picked.application_id}`}>
                                Application #{picked.application_id} · {picked.full_name}
                            </p>
                        )}
                        <div className="grid gap-1.5">
                            <Label htmlFor="mail-sendnow-email">Recipient email (optional)</Label>
                            <Input
                                id="mail-sendnow-email"
                                type="email"
                                value={toEmail}
                                onChange={(e) => setToEmail(e.target.value)}
                                placeholder="Blank = application record email"
                                disabled={sending}
                                className="truncate"
                            />
                            <p className="text-xs text-muted-foreground">
                                {emailError ?? "One click sends exactly one invite to this address."}
                            </p>
                        </div>
                    </div>
                )}
                <DialogFooter className="flex-col gap-2 sm:flex-row">
                    <Button variant="outline" className="w-full sm:w-auto" disabled={sending} onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        className="w-full sm:w-auto"
                        disabled={loading || sending || !picked || emailError !== null}
                        onClick={() => void handleSend()}
                    >
                        {sending ? "Sending…" : "Send now"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
