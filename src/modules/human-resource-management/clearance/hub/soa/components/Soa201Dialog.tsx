"use client";

import { useEffect, useState } from "react";
import type { JSX } from "react";
import { Loader2, RefreshCw, Save, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { fileSoa201, pickSoaPdfFile, uploadSoa201Staged } from "../utils/soaPdfUpload";

interface Soa201DialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    documentId: number;
    pdfFile: string | null;
    description: string;
    readOnly: boolean;
    onUploaded: () => void;
}

export function Soa201Dialog({
    open,
    onOpenChange,
    documentId,
    pdfFile,
    description,
    readOnly,
    onUploaded,
}: Soa201DialogProps): JSX.Element {
    const [currentPdf, setCurrentPdf] = useState<string | null>(null);
    const [stagedFileId, setStagedFileId] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [previewKey, setPreviewKey] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const previewId = stagedFileId ?? currentPdf;
    const hasCopy = previewId !== null && previewId !== "";

    useEffect(() => {
        setCurrentPdf(pdfFile === null || pdfFile === "" ? null : pdfFile);
    }, [pdfFile]);

    useEffect(() => {
        setError(false);
        setLoading(open && previewId !== null && previewId !== "");
    }, [open, previewId, previewKey]);

    async function handleUpload(): Promise<void> {
        if (readOnly || uploading || saving) return;
        setUploading(true);
        try {
            const file = await pickSoaPdfFile();
            if (file === null) return;
            const { fileId } = await uploadSoa201Staged({
                documentId,
                bytes: new Uint8Array(await file.arrayBuffer()),
                fileName: file.name,
            });
            setStagedFileId(fileId);
            setError(false);
            setLoading(true);
            setPreviewKey((key) => key + 1);
            toast.success("Signed copy uploaded. Press Save to file it.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not upload the signed copy to the 201 file.");
        } finally {
            setUploading(false);
        }
    }

    async function handleSave(): Promise<void> {
        if (stagedFileId === null || readOnly || saving || uploading) return;
        setSaving(true);
        try {
            await fileSoa201({ documentId, fileId: stagedFileId });
            setStagedFileId(null);
            toast.success("Signed copy filed to the 201 file.");
            onUploaded();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not file the signed copy to the 201 file.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 sm:max-w-[85vw] lg:max-w-[1000px]"
                onFocusOutside={(event) => event.preventDefault()}
            >
                <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6">
                    <DialogTitle className="text-base">201 file</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto bg-muted/60 p-3 sm:p-6">
                    <div className="mx-auto max-w-3xl space-y-3">
                        {stagedFileId !== null ? (
                            <p className="text-xs text-muted-foreground">New signed copy staged. Press Save to file it.</p>
                        ) : null}
                        {hasCopy ? (
                            <div className="overflow-hidden rounded-[var(--radius)] border bg-card shadow-md">
                                <div className="relative">
                                    {error ? (
                                        <div className="flex flex-col items-center justify-center gap-3 px-4 py-16">
                                            <p className="text-sm text-destructive">Could not load the signed copy.</p>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setPreviewKey((key) => key + 1)}
                                            >
                                                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                                                Retry
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            {loading ? (
                                                <div className="absolute inset-0 z-10 flex items-center justify-center gap-3 bg-card">
                                                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                                                    <p className="text-sm text-muted-foreground">Loading signed copy…</p>
                                                </div>
                                            ) : null}
                                            {open ? (
                                                <iframe
                                                    key={previewKey}
                                                    src={
                                                        stagedFileId !== null
                                                            ? `/api/hrm/clearance/soa/${documentId}/201?staged=${encodeURIComponent(stagedFileId)}#zoom=page-width`
                                                            : `/api/hrm/clearance/soa/${documentId}/201?v=${encodeURIComponent(currentPdf ?? "")}#zoom=page-width`
                                                    }
                                                    className="h-[68vh] w-full border-0 sm:h-[72vh]"
                                                    title="201 file preview"
                                                    onLoad={() => setLoading(false)}
                                                    onError={() => {
                                                        setLoading(false);
                                                        setError(true);
                                                    }}
                                                />
                                            ) : null}
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius)] border bg-card px-4 py-16 text-center shadow-sm">
                                <p className="text-sm font-medium">No signed copy uploaded yet.</p>
                                <p className="max-w-md text-xs text-muted-foreground">
                                    Print the statement of account, have it signed, then upload the scanned copy here.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter className="shrink-0 flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end">
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => void handleUpload()}
                        disabled={readOnly || uploading || saving}
                    >
                        {uploading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                        )}
                        {uploading ? "Uploading…" : "Upload"}
                    </Button>
                    <Button
                        variant="default"
                        className="w-full sm:w-auto"
                        onClick={() => void handleSave()}
                        disabled={stagedFileId === null || readOnly || saving || uploading}
                    >
                        {saving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                        )}
                        {saving ? "Saving…" : "Save"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
