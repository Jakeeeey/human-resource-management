"use client";

import { Download, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export function RecommendationLetterPreviewModal({
    isOpen,
    onOpenChange,
    pdfUrl,
    fileName,
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    pdfUrl: string | null;
    fileName: string;
}) {
    const handlePrint = () => {
        if (!pdfUrl) return;
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = pdfUrl;
        document.body.appendChild(iframe);
        iframe.onload = () => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => document.body.removeChild(iframe), 1000);
        };
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const anchor = document.createElement("a");
        anchor.href = pdfUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 sm:max-w-3xl">
                <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6">
                    <DialogTitle className="text-base">Recommendation letter</DialogTitle>
                    <DialogDescription className="truncate text-xs" title={fileName}>
                        {fileName}
                    </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto bg-muted/60 p-3 sm:p-6">
                    {pdfUrl ? (
                        <div className="mx-auto max-w-2xl overflow-hidden rounded-[var(--radius)] border bg-card shadow-md">
                            <iframe
                                src={pdfUrl}
                                className="h-[60vh] w-full border-0 sm:h-[65vh]"
                                title="Recommendation letter preview"
                            />
                        </div>
                    ) : (
                        <div className="mx-auto flex max-w-2xl items-center justify-center rounded-[var(--radius)] border bg-card px-4 py-16 shadow-sm">
                            <p className="text-center text-sm text-muted-foreground">
                                Preview unavailable. Try issuing the letter again.
                            </p>
                        </div>
                    )}
                </div>
                <DialogFooter className="shrink-0 flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end">
                    <Button
                        variant="outline"
                        onClick={handlePrint}
                        disabled={!pdfUrl}
                        className="w-full sm:w-auto"
                    >
                        <Printer className="h-4 w-4" aria-hidden="true" />
                        Print
                    </Button>
                    <Button
                        onClick={handleDownload}
                        disabled={!pdfUrl}
                        className="w-full sm:w-auto"
                    >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        Download PDF
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
