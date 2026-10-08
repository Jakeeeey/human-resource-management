"use client";

import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { AlertCircle, Download, Loader2, Printer, Save } from "lucide-react";
import { toast } from "sonner";

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { buildSoaPdf, type SoaPrintInput } from "../utils/soaPrintPdf";
import { freezeApprovedSoaPdf } from "../utils/approvedPdfFreeze";
import type { CompanyOption } from "../../utils/company";

interface SoaPrintDialogProps {
    soaId: number | null;
    pdfFile: string | null;
    model: SoaPrintInput | null;
    fileName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    requestId: number;
    companyOptions: CompanyOption[];
    companiesLoading: boolean;
    employeeCompany: CompanyOption | null;
    employeeCompanyLoading: boolean;
    selectedCompanyId: number | null;
    onSelectCompany: (id: number | null) => void;
    onCompanySaved: (companyId: number) => void;
    isApproved: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function toFitWidthUrl(url: string): string {
    const hashIndex = url.indexOf("#");
    if (hashIndex === -1) return `${url}#zoom=page-width`;
    const base = url.slice(0, hashIndex);
    const fragment = url.slice(hashIndex + 1);
    if (fragment.includes("zoom=")) return url;
    return fragment ? `${base}#${fragment}&zoom=page-width` : `${base}#zoom=page-width`;
}

export function SoaPrintDialog({
    soaId,
    pdfFile,
    model,
    fileName,
    open,
    onOpenChange,
    requestId,
    companyOptions,
    companiesLoading,
    employeeCompany,
    employeeCompanyLoading,
    selectedCompanyId,
    onSelectCompany,
    onCompanySaved,
    isApproved,
}: SoaPrintDialogProps): JSX.Element {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [building, setBuilding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savingCompany, setSavingCompany] = useState(false);
    const [companySaveError, setCompanySaveError] = useState<string | null>(null);
    const [freezeState, setFreezeState] = useState<"idle" | "freezing" | "done" | "error">("idle");
    const [freezeError, setFreezeError] = useState<string | null>(null);
    const urlRef = useRef<string | null>(null);
    const freezeKeyRef = useRef<string | null>(null);
    const printingRef = useRef(false);
    const printingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const viewUrl = previewUrl ? toFitWidthUrl(previewUrl) : null;

    useEffect(() => {
        if (!open) {
            if (urlRef.current) {
                URL.revokeObjectURL(urlRef.current);
                urlRef.current = null;
            }
            setPreviewUrl(null);
            setFreezeError(null);
            setCompanySaveError(null);
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
            if (!model) {
                throw new Error("missing-model");
            }
            const bytes = buildSoaPdf(model);
            if (cancelled) return;
            const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            urlRef.current = url;
            setPreviewUrl(url);
        } catch {
            if (!cancelled) setError("Could not build the PDF. Please try again.");
        } finally {
            if (!cancelled) setBuilding(false);
        }
        return () => {
            cancelled = true;
        };
    }, [open, model]);

    useEffect(() => {
        if (!open || !isApproved || soaId === null || model === null || model.refNo === "" || pdfFile) return;
        if (building || previewUrl === null) return;
        const key = `${soaId}:${model.refNo}`;
        if (freezeKeyRef.current === key || freezeState !== "idle") return;
        freezeKeyRef.current = key;
        setFreezeState("freezing");
        setFreezeError(null);
        const snapshot = model;
        const uploadName = fileName === "" ? `SOA - ${model.refNo}.pdf` : fileName;
        (async () => {
            try {
                const bytes = buildSoaPdf(snapshot);
                await freezeApprovedSoaPdf({ documentId: soaId, bytes, fileName: uploadName });
                setFreezeState("done");
            } catch {
                freezeKeyRef.current = null;
                setFreezeState("error");
                setFreezeError("Could not store the approved PDF to the 201 file. Reopen this dialog to retry.");
            }
        })();
    }, [open, soaId, model, pdfFile, building, previewUrl, fileName, freezeState, isApproved]);

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

    async function handleSaveCompany(): Promise<void> {
        if (savingCompany) return;
        if (selectedCompanyId === null) {
            setCompanySaveError("Choose a company first.");
            return;
        }
        setSavingCompany(true);
        setCompanySaveError(null);
        try {
            const res = await fetch("/api/hrm/clearance/employee-company", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ request_id: requestId, company_id: selectedCompanyId }),
            });
            const payload: unknown = await res.json().catch(() => null);
            if (!res.ok || !isRecord(payload) || payload.success !== true) {
                const message = isRecord(payload) && typeof payload.message === "string" && payload.message.trim() !== ""
                    ? payload.message
                    : "Could not save the company. Please try again.";
                throw new Error(message);
            }
            toast.success("Company saved. The reference number was generated.");
            onCompanySaved(selectedCompanyId);
        } catch (err) {
            setCompanySaveError(err instanceof Error ? err.message : "Could not save the company. Please try again.");
        } finally {
            setSavingCompany(false);
        }
    }

    const showCompanySave = !employeeCompanyLoading && employeeCompany === null;

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
                        Print statement of account
                    </DialogTitle>
                    <DialogDescription>
                        {model ? `${model.employeeName} — ${model.refNo || "unapproved"}` : "Statement of account"}
                    </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto bg-muted/60 p-3 sm:p-6">
                    <div className="mx-auto max-w-3xl space-y-3">
                        {showCompanySave && (
                            <div className="grid gap-3 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:grid-cols-[1fr_auto] sm:items-end">
                                <div className="grid gap-1.5">
                                    <Label htmlFor="soa-print-company">Company</Label>
                                    <Select
                                        value={selectedCompanyId === null ? "" : String(selectedCompanyId)}
                                        onValueChange={(next) => onSelectCompany(next === "" ? null : Number(next))}
                                        disabled={companiesLoading || companyOptions.length === 0 || savingCompany}
                                    >
                                        <SelectTrigger id="soa-print-company" className="w-full truncate">
                                            <SelectValue placeholder={companiesLoading ? "Loading…" : "Choose a company"} />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-60">
                                            {companyOptions.map((option) => (
                                                <SelectItem key={option.id} value={String(option.id)}>
                                                    {option.company_name} ({option.company_code})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {companySaveError && (
                                        <p className="text-xs text-destructive">{companySaveError}</p>
                                    )}
                                </div>
                                <Button
                                    className="w-full sm:w-auto"
                                    onClick={() => void handleSaveCompany()}
                                    disabled={savingCompany || selectedCompanyId === null}
                                >
                                    {savingCompany ? (
                                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                    ) : (
                                        <Save className="h-4 w-4" aria-hidden="true" />
                                    )}
                                    {savingCompany ? "Saving…" : "Save"}
                                </Button>
                            </div>
                        )}
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
                                    title="Statement of account preview"
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
