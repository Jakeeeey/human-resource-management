"use client";

import { Download, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
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
            <DialogContent className="flex h-[96vh] w-[98vw] max-w-[98vw] flex-col gap-0 overflow-hidden rounded-2xl border-none p-0 shadow-2xl sm:max-w-none">
                <DialogHeader className="flex-none border-b bg-gradient-to-r from-primary to-primary/80 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-lg font-bold tracking-tight text-white">
                                Recommendation Letter — Print Preview
                            </DialogTitle>
                            <p className="mt-0.5 truncate text-xs text-primary-foreground/70" title={fileName}>
                                {fileName}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 pr-8">
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={handlePrint}
                                disabled={!pdfUrl}
                                className="h-8 gap-1.5 rounded-lg text-xs"
                            >
                                <Printer className="h-3.5 w-3.5" />
                                Print
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleDownload}
                                disabled={!pdfUrl}
                                className="h-8 gap-1.5 rounded-lg bg-white text-xs text-primary hover:bg-white/90"
                            >
                                <Download className="h-3.5 w-3.5" />
                                Download PDF
                            </Button>
                        </div>
                    </div>
                </DialogHeader>
                <div className="relative flex-1 overflow-hidden bg-muted/30">
                    {pdfUrl ? (
                        <iframe
                            src={pdfUrl}
                            className="h-full w-full border-0"
                            title="Recommendation letter PDF preview"
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <p className="text-sm text-muted-foreground">
                                Preview unavailable. Try issuing the letter again.
                            </p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
