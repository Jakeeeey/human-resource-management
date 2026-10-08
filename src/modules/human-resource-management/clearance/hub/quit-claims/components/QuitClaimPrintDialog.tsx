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
import { Label } from "@/components/ui/label";
import type { CompanyOption } from "../../utils/company";
import { companyLogoDataUrl, fetchEmployeeCompany, pickEmployeeCompany } from "../../utils/company";
import { buildQuitClaimPdf, type QuitClaimCompany } from "../utils/quitClaimPrintPdf";
import { freezeApprovedQuitClaimPdf } from "../utils/approvedPdfFreeze";
import { phToday } from "../../utils/time";
import { QuitClaimCompanySelect } from "./QuitClaimCompanySelect";
import {
    findCompanyByCode,
    getQuitClaimValues,
    loadCompanyOptions,
    quitClaimErrorMessage,
    type QuitClaimDetail,
} from "../providers/quitClaimClient";

interface QuitClaimPrintDialogProps {
    quitclaim: QuitClaimDetail | null;
    initialCompany: CompanyOption | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
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

export function QuitClaimPrintDialog({ quitclaim, initialCompany, open, onOpenChange }: QuitClaimPrintDialogProps): JSX.Element {
    const [company, setCompany] = useState<CompanyOption | null>(null);
    const [companyOptions, setCompanyOptions] = useState<CompanyOption[] | undefined>(undefined);
    const [employeeCompanyId, setEmployeeCompanyId] = useState<number | null | undefined>(undefined);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>("");
    const [building, setBuilding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [freezeState, setFreezeState] = useState<"idle" | "freezing" | "done" | "error">("idle");
    const [freezeError, setFreezeError] = useState<string | null>(null);
    const urlRef = useRef<string | null>(null);
    const freezeKeyRef = useRef<string | null>(null);
    const pdfBytesRef = useRef<Uint8Array | null>(null);
    const printingRef = useRef(false);
    const printingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const viewUrl = previewUrl ? toFitWidthUrl(previewUrl) : null;
    const employeeCompany = typeof employeeCompanyId === "number" && companyOptions !== undefined
        ? pickEmployeeCompany(companyOptions, employeeCompanyId)
        : null;
    const persistedCompany = companyOptions !== undefined && quitclaim !== null
        ? findCompanyByCode(companyOptions, quitclaim.values.letterhead_company_code)
        : null;
    const letterheadReady = companyOptions !== undefined && employeeCompanyId !== undefined;

    useEffect(() => {
        if (!open || quitclaim === null) {
            setCompanyOptions(undefined);
            setEmployeeCompanyId(undefined);
            return;
        }
        let cancelled = false;
        setCompany(initialCompany);
        setCompanyOptions(undefined);
        setEmployeeCompanyId(undefined);
        setFreezeState("idle");
        setFreezeError(null);
        freezeKeyRef.current = null;
        (async () => {
            try {
                const rows = await loadCompanyOptions();
                if (!cancelled) setCompanyOptions(rows);
            } catch {
                if (!cancelled) setCompanyOptions([]);
            }
        })();
        (async () => {
            try {
                const result = await fetchEmployeeCompany({ userId: quitclaim.user_id });
                if (!cancelled) setEmployeeCompanyId(result.company_id);
            } catch {
                if (!cancelled) setEmployeeCompanyId(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, quitclaim, initialCompany]);

    useEffect(() => {
        if (company !== null) return;
        if (persistedCompany !== null) {
            setCompany(persistedCompany);
            return;
        }
        if (employeeCompany !== null) {
            setCompany(employeeCompany);
        }
    }, [company, persistedCompany, employeeCompany]);

    useEffect(() => {
        if (!open || quitclaim === null) {
            if (urlRef.current) {
                URL.revokeObjectURL(urlRef.current);
                urlRef.current = null;
            }
            setPreviewUrl(null);
            setFreezeError(null);
            pdfBytesRef.current = null;
            return;
        }
        if (!letterheadReady) {
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
        (async () => {
            try {
                const values = await getQuitClaimValues(quitclaim.id);
                if (cancelled) {
                    return;
                }
                const pdfBytes = buildQuitClaimPdf(values, toRendererCompany(company));
                const blob = new Blob(
                    [pdfBytes as BlobPart],
                    { type: "application/pdf" }
                );
                if (cancelled) {
                    return;
                }
                const url = URL.createObjectURL(blob);
                urlRef.current = url;
                pdfBytesRef.current = pdfBytes;
                setPreviewUrl(url);
                const stamp = phToday();
                setFileName(`Quit Claim - ${toFileName(values.identity.name)} - ${stamp}.pdf`);
            } catch (buildError) {
                if (!cancelled) {
                    setError(quitClaimErrorMessage(buildError, "Could not build the PDF. Please try again."));
                }
            } finally {
                if (!cancelled) {
                    setBuilding(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, quitclaim, company, letterheadReady]);

    useEffect(() => {
        if (!open || quitclaim === null || quitclaim.status !== "approved" || quitclaim.pdf_file) return;
        if (!letterheadReady || company === null) return;
        if (previewUrl === null || pdfBytesRef.current === null) return;
        const key = `${quitclaim.id}:${quitclaim.ref_no ?? ""}`;
        if (freezeKeyRef.current === key || freezeState !== "idle") return;
        freezeKeyRef.current = key;
        setFreezeState("freezing");
        setFreezeError(null);
        const bytes = pdfBytesRef.current;
        const uploadName = fileName === "" ? `Quit Claim - ${quitclaim.ref_no ?? quitclaim.id}.pdf` : fileName;
        (async () => {
            try {
                await freezeApprovedQuitClaimPdf({ documentId: quitclaim.id, bytes, fileName: uploadName });
                setFreezeState("done");
            } catch {
                freezeKeyRef.current = null;
                setFreezeState("error");
                setFreezeError("Could not store the approved PDF to the 201 file. Reopen this dialog to retry.");
            }
        })();
    }, [open, quitclaim, previewUrl, fileName, freezeState, letterheadReady, company]);

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
                className="flex max-h-[90vh] w-[95vw] flex-col overflow-hidden p-0 sm:max-w-[85vw] lg:max-w-[1000px]"
                onFocusOutside={(event) => event.preventDefault()}
            >
                <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <Printer className="h-4 w-4" aria-hidden="true" />
                        Print quit claim
                    </DialogTitle>
                    <DialogDescription>
                        {quitclaim?.ref_no ?? "Pending"} — {company !== null
                            ? `letterhead: ${company.company_name}.`
                            : "choose the letterhead company, then print or download."}
                    </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto bg-muted/60 p-3 sm:p-6">
                    <div className="mx-auto max-w-3xl space-y-3">
                        <div className="space-y-1 rounded-[var(--radius)] border bg-card p-3 shadow-sm">
                            <Label htmlFor="quitclaim-print-company">Letterhead company</Label>
                            {!letterheadReady ? (
                            <p className="text-xs text-muted-foreground">Loading letterhead…</p>
                            ) : (
                            <QuitClaimCompanySelect
                                id="quitclaim-print-company"
                                value={company}
                                onValueChange={setCompany}
                                disabled={building}
                                options={companyOptions ?? []}
                            />
                            )}
                        </div>
                        {error && (
                            <Alert variant="destructive" className="bg-card">
                                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                                <AlertTitle>Could not build the PDF.</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        {freezeState === "freezing" && (
                            <p className="text-xs text-muted-foreground">
                                Storing the approved PDF to the 201 file…
                            </p>
                        )}
                        {freezeState === "done" && (
                            <p className="text-xs text-muted-foreground">
                                Approved PDF stored to the 201 file.
                            </p>
                        )}
                        {freezeError && (
                            <p className="text-xs text-destructive">{freezeError}</p>
                        )}
                        {building || !letterheadReady ? (
                            <div className="flex items-center justify-center gap-3 rounded-[var(--radius)] border bg-card px-4 py-16 shadow-sm">
                                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                                <p className="text-sm text-muted-foreground">Generating PDF preview…</p>
                            </div>
                        ) : previewUrl ? (
                            <div className="overflow-hidden rounded-[var(--radius)] border bg-card shadow-md">
                                <iframe
                                    src={viewUrl ?? previewUrl}
                                    className="h-[68vh] w-full border-0 sm:h-[72vh]"
                                    title="Quit claim preview"
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
                    <Button variant="outline" className="min-h-11 w-full sm:w-auto md:min-h-0" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="outline"
                        className="min-h-11 w-full sm:w-auto md:min-h-0"
                        onClick={handlePrint}
                        disabled={!previewUrl || building}
                    >
                        <Printer className="h-4 w-4" aria-hidden="true" />
                        Print
                    </Button>
                    <Button
                        variant="outline"
                        className="min-h-11 w-full sm:w-auto md:min-h-0"
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
