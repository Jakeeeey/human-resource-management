"use client";

import React from "react";
import { Eraser, FileSignature, Loader2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InkCanvas } from "@/modules/human-resource-management/recruitment/signing/InkCanvas";
import {
    closePdfDocument,
    loadPdfDocument,
    type PdfNaturalSize,
    type SigningPdfDocument,
} from "@/modules/human-resource-management/recruitment/signing/components/pdfDocument";
import { PdfPageCanvas } from "@/modules/human-resource-management/recruitment/signing/components/PdfPageCanvas";
import { renderSignedItemPdf } from "@/modules/human-resource-management/recruitment/signing/signingItemPdf";
import {
    isInkEmpty,
    type SigningInk,
    type SigningStroke,
} from "@/modules/human-resource-management/recruitment/signing/signingStrokes";
import { buildFilingFilename } from "@/modules/human-resource-management/recruitment/signing/signingVault";
import type { GeneratedTrainingLetter } from "./types";

export interface SignedTrainingLetter {
    blob: Blob;
    fileName: string;
    url: string;
    byteLength: number;
    pageCount: number;
}

export interface PreEmploymentTrainingLetterSignProps {
    letter: GeneratedTrainingLetter;
    filingKey?: string;
    onSigned?: (result: SignedTrainingLetter) => void;
}

const TRAINING_SIGN_WIDTH = 800;

function fallbackSize(): PdfNaturalSize {
    return { width: TRAINING_SIGN_WIDTH, height: Math.round((TRAINING_SIGN_WIDTH * 297) / 210) };
}

function defaultFilingKey(fileName: string): string {
    const base = fileName.replace(/\.pdf$/i, "").trim();
    return base === "" ? "pre-employment-training-letter" : base;
}

export function PreEmploymentTrainingLetterSign({
    letter,
    filingKey,
    onSigned,
}: PreEmploymentTrainingLetterSignProps) {
    const [doc, setDoc] = React.useState<SigningPdfDocument | null>(null);
    const [docError, setDocError] = React.useState<string | null>(null);
    const [pageCount, setPageCount] = React.useState<number | null>(null);
    const [sizes, setSizes] = React.useState<Record<number, PdfNaturalSize>>({});
    const [inkPages, setInkPages] = React.useState<Record<number, SigningStroke[]>>({});
    const [signing, setSigning] = React.useState(false);
    const [signError, setSignError] = React.useState<string | null>(null);
    const [signed, setSigned] = React.useState<SignedTrainingLetter | null>(null);
    const signedUrlRef = React.useRef<string | null>(null);
    const onSignedRef = React.useRef(onSigned);
    onSignedRef.current = onSigned;

    React.useEffect(() => {
        let dropped = false;
        let active: SigningPdfDocument | null = null;
        setDoc(null);
        setDocError(null);
        setPageCount(null);
        setSizes({});
        setInkPages({});
        setSignError(null);
        loadPdfDocument(letter.url)
            .then((loaded) => {
                if (dropped) {
                    closePdfDocument(loaded);
                    return;
                }
                active = loaded;
                setDoc(loaded);
                setPageCount(loaded.numPages);
            })
            .catch((err: unknown) => {
                if (dropped) return;
                setDocError(err instanceof Error ? err.message : "The letter could not be loaded for signing");
            });
        return () => {
            dropped = true;
            closePdfDocument(active);
        };
    }, [letter.url]);

    React.useEffect(() => {
        return () => {
            if (signedUrlRef.current) URL.revokeObjectURL(signedUrlRef.current);
        };
    }, []);

    const pages = React.useMemo(
        () => (pageCount === null ? [] : Array.from({ length: pageCount }, (_, index) => index + 1)),
        [pageCount]
    );

    const ink: SigningInk = React.useMemo(
        () => ({
            pages: pages.map((page) => ({ page, strokes: inkPages[page] ?? [] })),
        }),
        [pages, inkPages]
    );

    const hasInk = !isInkEmpty(ink);
    const canSign = doc !== null && hasInk && !signing && pages.length > 0;

    const handlePdfNaturalSize = React.useCallback((page: number, size: PdfNaturalSize) => {
        setSizes((prev) => (prev[page] === undefined ? { ...prev, [page]: size } : prev));
    }, []);

    const handleStrokesChange = React.useCallback((page: number, strokes: SigningStroke[]) => {
        setInkPages((prev) => ({ ...prev, [page]: strokes }));
        setSigned(null);
        setSignError(null);
    }, []);

    const handleClearAll = React.useCallback(() => {
        setInkPages({});
        setSigned(null);
        setSignError(null);
    }, []);

    const handleSign = React.useCallback(async () => {
        if (doc === null || signing || pages.length === 0) return;
        const current: SigningInk = {
            pages: pages.map((page) => ({ page, strokes: inkPages[page] ?? [] })),
        };
        if (isInkEmpty(current)) return;
        setSigning(true);
        setSignError(null);
        try {
            const bytes = await renderSignedItemPdf({
                doc,
                pages,
                targetWidth: TRAINING_SIGN_WIDTH,
                ink: current,
            });
            const view = Uint8Array.from(bytes);
            const blob = new Blob([view.buffer as ArrayBuffer], { type: "application/pdf" });
            const fileName = buildFilingFilename(filingKey ?? defaultFilingKey(letter.fileName), 1);
            const url = URL.createObjectURL(blob);
            if (signedUrlRef.current) URL.revokeObjectURL(signedUrlRef.current);
            signedUrlRef.current = url;
            const result: SignedTrainingLetter = {
                blob,
                fileName,
                url,
                byteLength: bytes.byteLength,
                pageCount: pages.length,
            };
            setSigned(result);
            onSignedRef.current?.(result);
        } catch (err) {
            setSignError(err instanceof Error ? err.message : "Signing failed");
        } finally {
            setSigning(false);
        }
    }, [doc, signing, pages, inkPages, filingKey, letter.fileName]);

    const validityText = hasInk
        ? "Signature captured — confirm below to produce the signed PDF"
        : "Draw your signature anywhere to enable signing";

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="shrink-0 rounded-lg border border-warning/25 bg-warning/10 p-2">
                        <PenLine className="h-5 w-5 text-warning" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold leading-tight">
                            Sign the issued letter
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground" role="status">
                            {validityText}
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleClearAll}
                        disabled={signing || !hasInk}
                    >
                        <Eraser className="mr-2 h-4 w-4" aria-hidden="true" />
                        Clear all
                    </Button>
                    <Button type="button" size="sm" onClick={() => void handleSign()} disabled={!canSign}>
                        {signing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <FileSignature className="mr-2 h-4 w-4" aria-hidden="true" />
                        )}
                        Confirm signature
                    </Button>
                </div>
            </div>

            {docError !== null ? (
                <div
                    role="alert"
                    className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-6 text-center"
                >
                    <p className="mx-auto max-w-[420px] truncate text-sm text-muted-foreground" title={docError}>
                        The letter could not be shown for signing.
                    </p>
                </div>
            ) : null}

            {signError !== null ? (
                <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3">
                    <p className="truncate text-sm text-destructive" title={signError}>
                        {signError}
                    </p>
                </div>
            ) : null}

            {pages.map((page) => {
                const size = sizes[page] ?? fallbackSize();
                return (
                    <div key={page} className="mx-auto w-full max-w-3xl overflow-hidden">
                        <div className="mb-2 flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">Page {page}</span>
                        </div>
                        <div
                            className="relative w-full overflow-hidden rounded-lg border border-border bg-card"
                            style={{ aspectRatio: `${size.width} / ${size.height}` }}
                            aria-label={`Training letter page ${page} with signature overlay`}
                        >
                            <PdfPageCanvas
                                doc={doc}
                                docError={docError}
                                page={page}
                                beyondEnd={false}
                                targetWidth={TRAINING_SIGN_WIDTH}
                                onNaturalSize={handlePdfNaturalSize}
                            />
                            <InkCanvas
                                page={page}
                                value={inkPages[page] ?? []}
                                onChange={(next) => handleStrokesChange(page, next)}
                                width={size.width}
                                height={size.height}
                                disabled={signing}
                                transparent
                                className="absolute inset-0"
                                ariaLabel={`Signature overlay for page ${page}`}
                            />
                        </div>
                    </div>
                );
            })}

            {pages.length > 0 ? (
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                        {hasInk
                            ? "Your signature is ready — confirm to produce the signed PDF."
                            : "Draw your signature on any page to enable confirming."}
                    </p>
                    <Button type="button" size="sm" onClick={() => void handleSign()} disabled={!canSign}>
                        {signing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <FileSignature className="mr-2 h-4 w-4" aria-hidden="true" />
                        )}
                        Confirm signature
                    </Button>
                </div>
            ) : null}

            {signed !== null ? (
                <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <p className="truncate text-xs text-muted-foreground" title={signed.fileName}>
                        {signed.fileName}
                    </p>
                    <Button type="button" variant="outline" className="w-full sm:w-auto" asChild>
                        <a href={signed.url} download={signed.fileName}>
                            Download signed PDF
                        </a>
                    </Button>
                </div>
            ) : null}
        </div>
    );
}

export default PreEmploymentTrainingLetterSign;
