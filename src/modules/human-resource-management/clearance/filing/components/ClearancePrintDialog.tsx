"use client";

import { useState } from "react";
import type { JSX } from "react";
import { AlertCircle, Download, Loader2, Printer } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { CLEARANCE_REQUEST_STATUS_LABELS } from "../types";
import type { ClearancePrintable, FilingDetail } from "../providers/clearanceFilingClient";
import { formatPHT, phToday } from "../utils/time";
import {
    buildClearancePdf,
    downloadClearancePdf,
    strokesToSignatureDataUrl,
    type ClearancePrintRow,
    type ClearancePrintSignature,
} from "../utils/clearancePrintPdf";

interface ClearancePrintDialogProps {
    detail: FilingDetail;
    printable: ClearancePrintable | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function printableById(printable: ClearancePrintable | null): Map<number, ClearancePrintable["items"][number]> {
    const map = new Map<number, ClearancePrintable["items"][number]>();
    if (!printable) return map;
    for (const entry of printable.items) map.set(entry.id, entry);
    return map;
}

function toFileName(employeeName: string): string {
    const cleaned = employeeName
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
    return cleaned === "" ? "Employee" : cleaned;
}

export function ClearancePrintDialog({
    detail,
    printable,
    open,
    onOpenChange,
}: ClearancePrintDialogProps): JSX.Element {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const unsignedCount = detail.items.filter((item) => item.status !== "signed").length;

    function handleDownload(): void {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            const rowsById = printableById(printable);
            const rows: ClearancePrintRow[] = detail.items.map((item) => {
                const row = rowsById.get(item.id);
                const signed = item.status === "signed";
                return {
                    category: item.label_snapshot,
                    signer: signed
                        ? (row?.signer_name ?? "Signed")
                        : (row?.expected_signer_name ?? "Not chosen yet"),
                    status: signed ? "Signed" : "Pending",
                    signedOn: signed ? formatPHT(item.signed_at) : "—",
                };
            });
            const signatures: ClearancePrintSignature[] = detail.items.map((item) => {
                const row = rowsById.get(item.id);
                const signed = item.status === "signed";
                return {
                    label: item.label_snapshot,
                    signerLine: signed
                        ? `Signed by ${row?.signer_name ?? "the signer"} on ${formatPHT(item.signed_at)}`
                        : `Pending signature (${row?.expected_signer_name ?? "no signer chosen yet"})`,
                    signatureDataUrl:
                        signed && row?.signature_strokes
                            ? strokesToSignatureDataUrl(row.signature_strokes)
                            : null,
                };
            });
            const blob = buildClearancePdf({
                employeeName: printable?.employee_name ?? "Employee",
                templateTitle: detail.template_title_snapshot ?? "Resignation Clearance",
                statusLabel: CLEARANCE_REQUEST_STATUS_LABELS[detail.status],
                progressLabel: `${detail.signed_count} of ${detail.total_count} categories signed`,
                assignedOn: formatPHT(detail.created_at),
                confirmedOn: detail.status === "completed" ? formatPHT(detail.confirmed_at) : "Not yet confirmed",
                advisory:
                    "Categories printed unsigned show blank signature boxes. Ink signatures collected on paper are never recorded in the system.",
                rows,
                signatures,
            });
            const stamp = phToday();
            downloadClearancePdf(blob, `Clearance - ${toFileName(printable?.employee_name ?? "Employee")} - ${stamp}.pdf`);
            onOpenChange(false);
        } catch {
            setError("Could not build the PDF. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Printer className="h-4 w-4" aria-hidden="true" />
                        Print clearance form
                    </DialogTitle>
                    <DialogDescription>
                        {detail.template_title_snapshot ?? "Resignation Clearance"} —{" "}
                        {detail.signed_count} of {detail.total_count} categories signed
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <Alert>
                        <AlertTitle>Before you print</AlertTitle>
                        <AlertDescription>
                            {unsignedCount > 0 ? (
                                <span>
                                    {unsignedCount} {unsignedCount === 1 ? "category is" : "categories are"} still
                                    unsigned and will print with a blank signature box. Signatures collected on
                                    paper are never recorded in the system.
                                </span>
                            ) : (
                                <span>
                                    All categories are signed. The printed form reflects the current state of your
                                    clearance.
                                </span>
                            )}
                        </AlertDescription>
                    </Alert>
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" aria-hidden="true" />
                            <AlertTitle>Could not build the PDF.</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button disabled={busy} onClick={handleDownload}>
                        {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <Download className="h-4 w-4" aria-hidden="true" />
                        )}
                        {busy ? "Building…" : "Download PDF"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
