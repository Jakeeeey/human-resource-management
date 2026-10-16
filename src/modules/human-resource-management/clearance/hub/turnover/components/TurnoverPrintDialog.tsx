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
import { type TurnoverPrintInput } from "../types";
import { buildTurnoverPrintPdfBytes } from "../utils/turnoverPrintPdf";

interface TurnoverPrintDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    input: TurnoverPrintInput | null;
}

function toFileName(employeeName: string): string {
    const cleaned = employeeName
        .split("")
        .filter((ch) => ch >= " " && !"<>:/\\|?*\"".includes(ch))
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

export function TurnoverPrintDialog({
    open,
    onOpenChange,
    input,
}: TurnoverPrintDialogProps): JSX.Element {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [building, setBuilding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState("");
    const urlRef = useRef<string | null>(null);
    const printingRef = useRef(false);
    const printingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const viewUrl = previewUrl ? toFitWidthUrl(previewUrl) : null;

    useEffect(() => {
        if (urlRef.current) {
            URL.revokeObjectURL(urlRef.current);
            urlRef.current = null;
        }
        setPreviewUrl(null);
        setError(null);
        if (!open) return;
        if (input === null) {
            setError("Could not build the PDF. Please try again.");
            return;
        }
        setBuilding(true);
        try {
            const bytes = buildTurnoverPrintPdfBytes(input);
            const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            urlRef.current = url;
            setPreviewUrl(url);
            setFileName(`Turnover Checklist - ${toFileName(input.employeeName ?? "Employee")}.pdf`);
        } catch {
            setError("Could not build the PDF. Please try again.");
        } finally {
            setBuilding(false);
        }
    }, [open, input]);

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
                className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 sm:max-w-[85vw] lg:max-w-[1000px]"
                onFocusOutside={(event) => event.preventDefault()}
            >
                <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <Printer className="h-4 w-4" aria-hidden="true" />
                        Print turnover checklist
                    </DialogTitle>
                    <DialogDescription>
                        {input ? input.employeeName ?? `Request #${input.requestId}` : "Turnover checklist"}
                        {input?.refNo ? ` — REF ${input.refNo}` : ""}
                    </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto bg-muted/60 p-3 sm:p-6">
                    <div className="mx-auto max-w-3xl space-y-3">
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
                                    title="Turnover checklist preview"
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
                        variant="outline"
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
