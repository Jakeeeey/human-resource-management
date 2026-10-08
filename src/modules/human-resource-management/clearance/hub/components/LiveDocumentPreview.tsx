"use client";

import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { Loader2 } from "lucide-react";

interface LiveDocumentPreviewProps {
    build: () => Uint8Array;
    revision: string;
    title: string;
    loadingLabel: string;
    unavailable: boolean;
    unavailableLabel: string;
    caption: string;
}

function toFitWidthUrl(url: string, page: number): string {
    const hashIndex = url.indexOf("#");
    const base = hashIndex === -1 ? url : url.slice(0, hashIndex);
    const fragment = hashIndex === -1 ? "" : url.slice(hashIndex + 1);
    const parts = fragment
        .split("&")
        .filter((part) => part !== "" && !part.startsWith("page=") && !part.startsWith("zoom="));
    parts.push(`page=${page}`);
    parts.push("zoom=page-width");
    return `${base}#${parts.join("&")}`;
}

export function LiveDocumentPreview(props: LiveDocumentPreviewProps): JSX.Element {
    const { build, revision, title, loadingLabel, unavailable, unavailableLabel, caption } = props;
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [building, setBuilding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const urlRef = useRef<string | null>(null);
    const pendingRevokeRef = useRef<string[]>([]);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const pageRef = useRef(1);
    const viewUrl = previewUrl ? toFitWidthUrl(previewUrl, pageRef.current) : null;

    useEffect(() => {
        if (unavailable) return;
        setBuilding(true);
        const timer = setTimeout(() => {
            let nextPage = pageRef.current;
            try {
                const hash = iframeRef.current?.contentWindow?.location.hash ?? "";
                const match = /page=(\d+)/.exec(hash);
                if (match) {
                    const parsed = Number.parseInt(match[1] ?? "", 10);
                    if (Number.isFinite(parsed) && parsed >= 1) {
                        nextPage = parsed;
                    }
                }
            } catch {
                nextPage = pageRef.current;
            }
            try {
                const pdfBytes = build();
                const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
                const url = URL.createObjectURL(blob);
                if (urlRef.current) {
                    pendingRevokeRef.current.push(urlRef.current);
                }
                urlRef.current = url;
                pageRef.current = nextPage;
                setPreviewUrl(url);
                setError(null);
            } catch {
                setError("Could not build the PDF preview.");
            } finally {
                setBuilding(false);
            }
        }, 700);
        return () => {
            clearTimeout(timer);
        };
    }, [build, revision, unavailable]);

    useEffect(() => {
        return () => {
            if (urlRef.current) {
                URL.revokeObjectURL(urlRef.current);
                urlRef.current = null;
            }
            const pending = pendingRevokeRef.current;
            pendingRevokeRef.current = [];
            for (const url of pending) {
                URL.revokeObjectURL(url);
            }
        };
    }, []);

    function handlePreviewLoad(): void {
        const pending = pendingRevokeRef.current;
        pendingRevokeRef.current = [];
        for (const url of pending) {
            URL.revokeObjectURL(url);
        }
    }

    if (unavailable) {
        return (
            <div className="flex items-center justify-center gap-3 rounded-xl border bg-card px-4 py-16 shadow-sm">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{unavailableLabel}</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                {error && (
                    <p className="px-4 py-6 text-center text-sm text-destructive">{error}</p>
                )}
                {!error && previewUrl === null && (
                    <div className="flex items-center justify-center gap-3 px-4 py-16">
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                        <p className="text-sm text-muted-foreground">{loadingLabel}</p>
                    </div>
                )}
                {!error && previewUrl !== null && (
                    <div className="relative">
                        {building && (
                            <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 bg-card/80 px-4 py-2 text-xs text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                Updating preview…
                            </div>
                        )}
                        <iframe
                            ref={iframeRef}
                            src={viewUrl ?? previewUrl}
                            className="h-[85vh] min-h-[600px] w-full border-0"
                            title={title}
                            onLoad={handlePreviewLoad}
                        />
                    </div>
                )}
            </div>
            <p className="text-xs text-muted-foreground">{caption}</p>
        </div>
    );
}
