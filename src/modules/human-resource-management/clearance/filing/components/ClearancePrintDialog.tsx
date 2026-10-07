"use client";

import { useEffect, useRef, useState } from "react";
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
import type { ClearancePrintable, FilingDetail } from "../providers/clearanceFilingClient";
import { phToday } from "../utils/time";
import {
    buildClearancePdf,
    strokesToSignatureDataUrl,
    type ClearancePrintEntry,
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
        .split("")
        .filter((ch) => ch >= " " && !"<>:\"/\\|?*".includes(ch))
        .join("")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
    return cleaned === "" ? "Employee" : cleaned;
}

function toFitWidthUrl(url: string): string {
    const hashIndex = url.indexOf("#");
    if (hashIndex === -1) return `${url}#zoom=page-width`;
    const base = url.slice(0, hashIndex);
    const fragment = url.slice(hashIndex + 1);
    if (fragment.includes("zoom=")) return url;
    return fragment ? `${base}#${fragment}&zoom=page-width` : `${base}#zoom=page-width`;
}

export function ClearancePrintDialog({
    detail,
    printable,
    open,
    onOpenChange,
}: ClearancePrintDialogProps): JSX.Element {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>("");
    const [building, setBuilding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const urlRef = useRef<string | null>(null);
    const printingRef = useRef(false);
    const printingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const unsignedCount = detail.items.filter((item) => item.status !== "signed").length;
    const viewUrl = previewUrl ? toFitWidthUrl(previewUrl) : null;

    useEffect(() => {
        if (!open) {
            if (urlRef.current) {
                URL.revokeObjectURL(urlRef.current);
                urlRef.current = null;
            }
            setPreviewUrl(null);
            return;
        }
        let cancelled = false;
        setBuilding(true);
        setError(null);
        if (urlRef.current) {
            URL.revokeObjectURL(urlRef.current);
            urlRef.current = null;
        }
        setPreviewUrl(null);
        try {
            const rowsById = printableById(printable);
            const entries: ClearancePrintEntry[] = detail.items.map((item) => {
                const row = rowsById.get(item.id);
                const signed = item.status === "signed";
                const rawName = signed ? row?.signer_name : row?.expected_signer_name;
                const trimmed = typeof rawName === "string" ? rawName.trim() : "";
                return {
                    category: item.label_snapshot,
                    signeeName: trimmed,
                    signatureDataUrl:
                        signed && row?.signature_strokes
                            ? strokesToSignatureDataUrl(row.signature_strokes)
                            : null,
                };
            });
            const blob = buildClearancePdf({
                employeeName: printable?.employee_name ?? "Employee",
                entries,
            });
            if (cancelled) return;
            const url = URL.createObjectURL(blob);
            urlRef.current = url;
            setPreviewUrl(url);
            const stamp = phToday();
            setFileName(`Clearance - ${toFileName(printable?.employee_name ?? "Employee")} - ${stamp}.pdf`);
        } catch {
            if (!cancelled) setError("Could not build the PDF. Please try again.");
        } finally {
            if (!cancelled) setBuilding(false);
        }
        return () => {
            cancelled = true;
        };
    }, [open, detail, printable]);

    useEffect(() => {
        return () => {
            if (urlRef.current) {
                URL.revokeObjectURL(urlRef.current);
                urlRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        function releasePrintGuard(): void {
            printingRef.current = false;
            if (printingTimerRef.current !== null) {
                clearTimeout(printingTimerRef.current);
                printingTimerRef.current = null;
            }
        }
        document.addEventListener("pointerdown", releasePrintGuard, true);
        document.addEventListener("keydown", releasePrintGuard, true);
        return () => {
            document.removeEventListener("pointerdown", releasePrintGuard, true);
            document.removeEventListener("keydown", releasePrintGuard, true);
        };
    }, []);

    function handleOpenChange(next: boolean): void {
        if (!next && printingRef.current) return;
        onOpenChange(next);
    }

    function handleDownload(): void {
        if (!previewUrl || !fileName) return;
        const anchor = document.createElement("a");
        anchor.href = previewUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
    }

    function handlePrint(): void {
        if (!previewUrl) return;
        printingRef.current = true;
        if (printingTimerRef.current !== null) {
            clearTimeout(printingTimerRef.current);
        }
        printingTimerRef.current = setTimeout(() => {
            printingRef.current = false;
            printingTimerRef.current = null;
        }, 60000);
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.left = "-10000px";
        iframe.style.top = "0";
        iframe.style.width = "1024px";
        iframe.style.height = "768px";
        iframe.style.border = "0";
        iframe.src = previewUrl;
        document.body.appendChild(iframe);
        iframe.onload = () => {
            const frameWindow = iframe.contentWindow;
            if (!frameWindow) return;
            const releaseFrame = () => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            };
            frameWindow.addEventListener("afterprint", releaseFrame, { once: true });
            frameWindow.focus();
            frameWindow.print();
            setTimeout(releaseFrame, 60000);
        };
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 sm:max-w-4xl lg:max-w-5xl"
                onFocusOutside={(event) => event.preventDefault()}
            >
                <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <Printer className="h-4 w-4" aria-hidden="true" />
                        Print clearance form
                    </DialogTitle>
                    <DialogDescription>
                        {detail.template_title_snapshot ?? "Resignation Clearance"} —{" "}
                        {detail.signed_count} of {detail.total_count} categories signed
                    </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto bg-muted/60 p-3 sm:p-6">
                    <div className="mx-auto max-w-3xl space-y-3">
                        <Alert className="bg-card">
                            <AlertTitle>Before you print</AlertTitle>
                            <AlertDescription>
                                {unsignedCount > 0 ? (
                                    <span>
                                        {unsignedCount} {unsignedCount === 1 ? "category is" : "categories are"} still
                                        unsigned and will print with a blank signature line. Signatures collected on
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
                            <Alert variant="destructive" className="bg-card">
                                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                                <AlertTitle>Could not build the PDF.</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        {building ? (
                            <div className="flex items-center justify-center gap-3 rounded-[var(--radius)] border bg-card px-4 py-16 shadow-sm">
                                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                                <p className="text-sm text-muted-foreground">Generating PDF preview…</p>
                            </div>
                        ) : previewUrl ? (
                            <div className="overflow-hidden rounded-[var(--radius)] border bg-card shadow-md">
                                <iframe
                                    src={viewUrl ?? previewUrl}
                                    className="h-[68vh] w-full border-0 sm:h-[72vh]"
                                    title="Clearance form preview"
                                />
                            </div>
                        ) : (
                            !error && (
                                <div className="flex items-center justify-center rounded-[var(--radius)] border bg-card px-4 py-16 shadow-sm">
                                    <p className="text-center text-sm text-muted-foreground">
                                        Preview unavailable. Try closing and opening this dialog again.
                                    </p>
                                </div>
                            )
                        )}
                    </div>
                </div>
                <DialogFooter className="shrink-0 flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end">
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={handlePrint}
                        disabled={!previewUrl || building}
                    >
                        <Printer className="h-4 w-4" aria-hidden="true" />
                        Print
                    </Button>
                    <Button
                        className="w-full sm:w-auto"
                        onClick={handleDownload}
                        disabled={!previewUrl || building}
                    >
                        {building ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <Download className="h-4 w-4" aria-hidden="true" />
                        )}
                        {building ? "Building…" : "Download PDF"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
