"use client";

import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import Image from "next/image";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ClearanceFormSchema, type ClearanceForm, type ClearanceFormRenderModel } from "../types";
import { useCompanyOptions } from "../hooks/useCompanyOptions";
import { companyLogoDataUrl, pickDefaultCompany } from "../../utils/company";
import { phToday } from "../../utils/time";
import { freezeIssuedFormPdf } from "../utils/issuedPdfFreeze";
import {
    buildClearancePdf,
    type ClearancePrintEntry,
} from "../utils/clearancePrintPdf";

interface ClearanceFormPrintDialogProps {
    form: ClearanceForm | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onIssued: (form: ClearanceForm) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
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

export function ClearanceFormPrintDialog({
    form,
    open,
    onOpenChange,
    onIssued,
}: ClearanceFormPrintDialogProps): JSX.Element {
    const [model, setModel] = useState<ClearanceFormRenderModel | null>(null);
    const [modelLoading, setModelLoading] = useState(false);
    const [modelError, setModelError] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>("");
    const [building, setBuilding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dateValue, setDateValue] = useState(phToday());
    const [companyCode, setCompanyCode] = useState("");
    const [issuing, setIssuing] = useState(false);
    const [issueError, setIssueError] = useState<string | null>(null);
    const [freezeState, setFreezeState] = useState<"idle" | "freezing" | "done" | "error">("idle");
    const [freezeError, setFreezeError] = useState<string | null>(null);
    const urlRef = useRef<string | null>(null);
    const freezeKeyRef = useRef<string | null>(null);
    const previewBlobRef = useRef<Blob | null>(null);
    const printingRef = useRef(false);
    const printingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { options: companies, isLoading: companiesLoading, error: companiesError } = useCompanyOptions();
    const viewUrl = previewUrl ? toFitWidthUrl(previewUrl) : null;

    const formId = form?.id ?? null;
    const formStatus = form?.status ?? null;
    const formRefNo = form?.ref_no ?? null;
    const formCompanyCode = form?.company_code ?? null;
    const requestId = form?.request_id ?? null;

    useEffect(() => {
        if (!open) {
            if (urlRef.current) {
                URL.revokeObjectURL(urlRef.current);
                urlRef.current = null;
            }
            setPreviewUrl(null);
            setModel(null);
            setIssueError(null);
            setFreezeError(null);
            previewBlobRef.current = null;
            return;
        }
        setDateValue(phToday());
        setCompanyCode("");
        setIssueError(null);
    }, [open, formId]);

    useEffect(() => {
        const fallback = formCompanyCode ?? pickDefaultCompany(companies, undefined)?.company_code ?? "";
        if (companyCode === "" && fallback !== "") setCompanyCode(fallback);
    }, [companies, formCompanyCode, companyCode]);

    useEffect(() => {
        if (!open || requestId === null) return;
        let cancelled = false;
        setModelLoading(true);
        setModelError(null);
        (async () => {
            try {
                const params = new URLSearchParams({
                    request_id: String(requestId),
                    date: dateValue,
                    ref_no: formStatus === "issued" ? (formRefNo ?? "") : "",
                });
                const res = await fetch(`/api/hrm/clearance/form/render-model?${params.toString()}`);
                if (!res.ok) throw new Error("render-model failed");
                const body: unknown = await res.json().catch(() => null);
                if (!isRecord(body) || body.success !== true || !isRecord(body.data)) {
                    throw new Error("render-model failed");
                }
                if (cancelled) return;
                setModel(body.data as ClearanceFormRenderModel);
            } catch {
                if (!cancelled) setModelError("Could not build the clearance form. Please try again.");
            } finally {
                if (!cancelled) setModelLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, requestId, dateValue, formStatus, formRefNo]);

    const selectedCompany = companies.find((option) => option.company_code === companyCode) ?? null;
    const letterheadLogo = companyLogoDataUrl(selectedCompany);

    useEffect(() => {
        if (!open) return;
        if (urlRef.current) {
            URL.revokeObjectURL(urlRef.current);
            urlRef.current = null;
        }
        setPreviewUrl(null);
        previewBlobRef.current = null;
        if (!model) return;
        setBuilding(true);
        setError(null);
        try {
            const entries: ClearancePrintEntry[] = model.roles.map((role) => ({
                category: role.label,
                signeeName: role.signeeName,
                signatureDataUrl: null,
                remarks: role.remarks,
            }));
            const blob = buildClearancePdf({
                employeeName: model.employeeName,
                entries,
                refNo: model.refNo,
                date: model.date,
                position: model.position,
                company_name: model.company_name ?? selectedCompany?.company_name,
                company_address: model.company_address ?? selectedCompany?.company_address ?? null,
                logo_data_url: model.logo_data_url ?? letterheadLogo,
            });
            const url = URL.createObjectURL(blob);
            urlRef.current = url;
            previewBlobRef.current = blob;
            setPreviewUrl(url);
            const stamp = phToday();
            setFileName(`Clearance - ${toFileName(model.employeeName)} - ${stamp}.pdf`);
        } catch {
            setError("Could not build the PDF. Please try again.");
        } finally {
            setBuilding(false);
        }
    }, [open, model, selectedCompany, letterheadLogo]);

    useEffect(() => {
        if (!open || !form || form.status !== "issued" || form.pdf_file) return;
        if (form.ref_no === null || model === null || model.refNo !== form.ref_no) return;
        if (!previewUrl || previewBlobRef.current === null) return;
        const key = `${form.id}:${form.ref_no}`;
        if (freezeKeyRef.current === key || freezeState !== "idle") return;
        freezeKeyRef.current = key;
        setFreezeState("freezing");
        setFreezeError(null);
        const blob = previewBlobRef.current;
        const uploadName = fileName === "" ? `Clearance Form - ${form.ref_no}.pdf` : fileName;
        (async () => {
            try {
                const bytes = new Uint8Array(await blob.arrayBuffer());
                await freezeIssuedFormPdf({ documentId: form.id, bytes, fileName: uploadName });
                setFreezeState("done");
            } catch {
                freezeKeyRef.current = null;
                setFreezeState("error");
                setFreezeError("Could not store the issued PDF to the 201 file. Reopen this dialog to retry.");
            }
        })();
    }, [open, form, model, previewUrl, fileName, freezeState]);

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

    async function handleIssue(): Promise<void> {
        if (requestId === null || issuing) return;
        const code = companyCode.trim();
        if (code === "") {
            setIssueError("Choose a company before issuing the form.");
            return;
        }
        setIssuing(true);
        setIssueError(null);
        try {
            const res = await fetch("/api/hrm/clearance/form/issue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ request_id: requestId, company_code: code, date: dateValue }),
            });
            const body: unknown = await res.json().catch(() => null);
            if (!res.ok || !isRecord(body) || body.success !== true || !isRecord(body.data)) {
                throw new Error("issue failed");
            }
            const issued = ClearanceFormSchema.safeParse(
                isRecord(body.data) && isRecord(body.data.form) ? body.data.form : body.data
            );
            if (!issued.success) throw new Error("issue failed");
            onIssued(issued.data);
        } catch {
            setIssueError("Could not issue the clearance form. Please try again.");
        } finally {
            setIssuing(false);
        }
    }

    const isDraft = formStatus === "draft";

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
                        {model ? model.employeeName : `Request #${requestId ?? "—"}`}
                        {formRefNo ? ` — REF ${formRefNo}` : ""}
                    </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto bg-muted/60 p-3 sm:p-6">
                    <div className="mx-auto max-w-3xl space-y-3">
                        <div className="grid gap-3 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="clearance-form-company">Company letterhead</Label>
                                <Select value={companyCode} onValueChange={setCompanyCode} disabled={companiesLoading}>
                                    <SelectTrigger id="clearance-form-company" className="w-full">
                                        <SelectValue
                                            placeholder={companiesLoading ? "Loading companies…" : "Choose a company"}
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {companies.map((option) => (
                                            <SelectItem key={option.id} value={option.company_code}>
                                                {option.company_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {companiesError && (
                                    <p className="text-xs text-destructive">{companiesError}</p>
                                )}
                                {selectedCompany?.company_address && (
                                    <p className="text-xs text-muted-foreground">{selectedCompany.company_address}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="clearance-form-date">Date</Label>
                                <Input
                                    id="clearance-form-date"
                                    type="date"
                                    value={dateValue}
                                    onChange={(event) => setDateValue(event.target.value)}
                                />
                            </div>
                            {letterheadLogo && (
                                <div className="flex items-center gap-3 sm:col-span-2">
                                    <Image
                                        src={letterheadLogo}
                                        alt={`${selectedCompany?.company_name ?? "Company"} logo`}
                                        width={160}
                                        height={40}
                                        className="h-10 w-auto object-contain"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {selectedCompany?.company_name ?? ""}
                                    </p>
                                </div>
                            )}
                            {isDraft && (
                                <div className="sm:col-span-2">
                                    {issueError && (
                                        <p className="mb-2 text-xs text-destructive">{issueError}</p>
                                    )}
                                    <Button
                                        size="sm"
                                        onClick={() => void handleIssue()}
                                        disabled={issuing || companiesLoading || companyCode.trim() === ""}
                                    >
                                        {issuing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                                        {issuing ? "Issuing…" : "Issue form (allocate REF No.)"}
                                    </Button>
                                </div>
                            )}
                            {!isDraft && freezeState === "freezing" && (
                                <p className="text-xs text-muted-foreground sm:col-span-2">
                                    Storing the issued PDF to the 201 file…
                                </p>
                            )}
                            {!isDraft && freezeState === "done" && (
                                <p className="text-xs text-muted-foreground sm:col-span-2">
                                    Issued PDF stored to the 201 file.
                                </p>
                            )}
                            {freezeError && (
                                <p className="text-xs text-destructive sm:col-span-2">{freezeError}</p>
                            )}
                        </div>
                        {(error ?? modelError) && (
                            <Alert variant="destructive" className="bg-card">
                                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                                <AlertTitle>Could not build the PDF.</AlertTitle>
                                <AlertDescription>{error ?? modelError}</AlertDescription>
                            </Alert>
                        )}
                        {building || modelLoading ? (
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
                            !(error ?? modelError) && (
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
