"use client";

import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { Loader2 } from "lucide-react";
import { companyLogoDataUrl, type CompanyOption } from "../../utils/company";
import { buildQuitClaimPdf, type QuitClaimCompany } from "../utils/quitClaimPrintPdf";
import type { QuitClaimValues } from "../types";

interface QuitClaimLivePreviewProps {
    values: QuitClaimValues | null;
    company: CompanyOption | null;
}

function toRendererCompany(selected: CompanyOption | null): QuitClaimCompany {
    if (selected === null) {
        return { company_name: "" };
    }
    return {
        company_name: selected.company_name,
        company_address: selected.company_address,
        company_contact: selected.company_contact,
        company_email: selected.company_email,
        logo_data_url: companyLogoDataUrl(selected),
    };
}

function toFitWidthUrl(url: string): string {
    const hashIndex = url.indexOf("#");
    if (hashIndex === -1) {
        return `${url}#zoom=page-width`;
    }
    const base = url.slice(0, hashIndex);
    const fragment = url.slice(hashIndex + 1);
    if (fragment.includes("zoom=")) {
        return url;
    }
    return fragment ? `${base}#${fragment}&zoom=page-width` : `${base}#zoom=page-width`;
}

export function QuitClaimLivePreview({ values, company }: QuitClaimLivePreviewProps): JSX.Element {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [building, setBuilding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const urlRef = useRef<string | null>(null);
    const viewUrl = previewUrl ? toFitWidthUrl(previewUrl) : null;

    useEffect(() => {
        if (values === null) {
            return;
        }
        setBuilding(true);
        const timer = setTimeout(() => {
            try {
                const pdfBytes = buildQuitClaimPdf(values, toRendererCompany(company));
                const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
                const url = URL.createObjectURL(blob);
                if (urlRef.current) {
                    URL.revokeObjectURL(urlRef.current);
                }
                urlRef.current = url;
                setPreviewUrl(url);
                setError(null);
            } catch {
                setError("Could not build the PDF preview.");
            } finally {
                setBuilding(false);
            }
        }, 250);
        return () => {
            clearTimeout(timer);
        };
    }, [values, company]);

    useEffect(() => {
        return () => {
            if (urlRef.current) {
                URL.revokeObjectURL(urlRef.current);
                urlRef.current = null;
            }
        };
    }, []);

    if (values === null) {
        return (
            <div className="flex items-center justify-center gap-3 rounded-xl border bg-card px-4 py-16 shadow-sm">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Loading quit claim…</p>
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
                        <p className="text-sm text-muted-foreground">Generating PDF preview…</p>
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
                            src={viewUrl ?? previewUrl}
                            className="h-[85vh] min-h-[600px] w-full border-0"
                            title="Quit claim live preview"
                        />
                    </div>
                )}
            </div>
            <p className="text-xs text-muted-foreground">Live preview updates as fields change.</p>
        </div>
    );
}
