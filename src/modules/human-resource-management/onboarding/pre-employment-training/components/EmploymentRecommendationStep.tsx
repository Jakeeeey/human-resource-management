"use client";

import React from "react";
import { CheckCircle2, Download, Eye, FileBadge, Printer, Save } from "lucide-react";
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
import { buildEmploymentRecommendationPdf, type EmploymentRecommendationPdfInput } from "../utils/employmentRecommendationPdf";
import type { EmploymentRecommendationAssembled } from "../server/employmentRecommendationInput";

export interface EmploymentRecommendationStepProps {
    userId: number;
    applicantId?: number | null;
    effectivityDate?: string;
    assembled?: EmploymentRecommendationAssembled | null;
    onGenerated?: (result: GeneratedRecommendationLetter) => void;
}

export interface GeneratedRecommendationLetter {
    blob: Blob;
    fileName: string;
    url: string;
}

interface RecommendationFields {
    employeeName: string;
    employeeAddress: string;
    salutationName: string;
    position: string;
    department: string;
    companyName: string;
    headerAddress: string;
    headerContact: string;
    headerEmail: string;
    letterDate: string;
    effectivityDate: string;
    probationText: string;
    preparedByName: string;
    preparedByTitle: string;
    notedByName: string;
    notedByTitle: string;
    approvedByName: string;
    approvedByTitle: string;
    acknowledgementName: string;
    acknowledgementLabel: string;
}

interface CompanyLogoRow {
    id: number;
    company_name: string;
    logo_data_url: string | null;
    headerAddress: string | null;
    headerContact: string | null;
    headerEmail: string | null;
}

function todayInputValue(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function text(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function nonEmptyString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value : null;
}

function parseCompanyRow(entry: unknown): CompanyLogoRow | null {
    if (typeof entry !== "object" || entry === null) return null;
    const record = entry as Record<string, unknown>;
    const id = Number(record.id);
    const name = nonEmptyString(record.company_name);
    if (!Number.isInteger(id) || id <= 0 || name === null) return null;
    return {
        id,
        company_name: name,
        logo_data_url: nonEmptyString(record.logo_data_url),
        headerAddress: nonEmptyString(record.company_address),
        headerContact: nonEmptyString(record.company_contact),
        headerEmail: nonEmptyString(record.company_email),
    };
}

function fieldsFromAssembled(assembled: EmploymentRecommendationAssembled | null | undefined, effectivityFallback: string): RecommendationFields {
    const input = assembled?.input;
    const today = todayInputValue();
    return {
        employeeName: text(input?.employeeName),
        employeeAddress: text(input?.employeeAddress),
        salutationName: text(input?.salutationName),
        position: text(input?.position),
        department: text(input?.department),
        companyName: text(input?.companyName),
        headerAddress: text(input?.headerAddress),
        headerContact: text(input?.headerContact),
        headerEmail: text(input?.headerEmail),
        letterDate: text(input?.letterDate) || today,
        effectivityDate: text(input?.effectivityDate) || effectivityFallback || today,
        probationText: text(input?.probationText),
        preparedByName: text(input?.preparedBy.name),
        preparedByTitle: text(input?.preparedBy.title),
        notedByName: text(input?.notedBy.name),
        notedByTitle: text(input?.notedBy.title),
        approvedByName: text(input?.approvedBy.name),
        approvedByTitle: text(input?.approvedBy.title),
        acknowledgementName: text(input?.acknowledgement.printedName),
        acknowledgementLabel: text(input?.acknowledgement.label),
    };
}

function toFitWidthUrl(url: string): string {
    const hashIndex = url.indexOf("#");
    if (hashIndex === -1) return `${url}#zoom=page-width`;
    const base = url.slice(0, hashIndex);
    const fragment = url.slice(hashIndex + 1);
    if (fragment.includes("zoom=")) return url;
    return fragment ? `${base}#${fragment}&zoom=page-width` : `${base}#zoom=page-width`;
}

function toBuilderInput(form: RecommendationFields): EmploymentRecommendationPdfInput {
    return {
        employeeName: form.employeeName,
        employeeAddress: form.employeeAddress,
        salutationName: form.salutationName,
        position: form.position,
        ...(form.department.trim() ? { department: form.department } : {}),
        companyName: form.companyName,
        headerAddress: form.headerAddress,
        headerContact: form.headerContact,
        headerEmail: form.headerEmail,
        letterDate: form.letterDate,
        effectivityDate: form.effectivityDate,
        ...(form.probationText.trim() ? { probationText: form.probationText } : {}),
        preparedBy: { name: form.preparedByName, title: form.preparedByTitle },
        notedBy: { name: form.notedByName, title: form.notedByTitle },
        approvedBy: { name: form.approvedByName, title: form.approvedByTitle },
        acknowledgement: {
            ...(form.acknowledgementLabel.trim() ? { label: form.acknowledgementLabel } : {}),
            printedName: form.acknowledgementName,
        },
    };
}

const RECOMMENDATION_URL = "/api/hrm/onboarding/employment-recommendation";
const MAX_PDF_BYTES = 10 * 1024 * 1024;

interface RecommendationIssuance {
    issued: boolean;
    fileRef: string | null;
    recordId: number | null;
    recordStatus: string | null;
}

function parseIssuance(entry: unknown): RecommendationIssuance | null {
    if (typeof entry !== "object" || entry === null) return null;
    const record = entry as Record<string, unknown>;
    if (typeof record.issued !== "boolean") return null;
    return {
        issued: record.issued,
        fileRef: typeof record.fileRef === "string" && record.fileRef ? record.fileRef : null,
        recordId: typeof record.recordId === "number" && Number.isInteger(record.recordId) && record.recordId > 0
            ? record.recordId
            : null,
        recordStatus: typeof record.recordStatus === "string" && record.recordStatus ? record.recordStatus : null,
    };
}

function savedAssetUrl(fileRef: string, fileName: string): string {
    return `/api/hrm/employee-admin/employee-master-list/assets/${fileRef}?filename=${encodeURIComponent(fileName)}`;
}

function readSaveMessage(body: unknown, fallback: string): string {
    if (typeof body === "object" && body !== null) {
        const message = (body as { message?: unknown }).message;
        if (typeof message === "string" && message.trim()) return message;
    }
    return fallback;
}

async function blobToBase64(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

export function EmploymentRecommendationStep({ userId, applicantId, effectivityDate, assembled, onGenerated }: EmploymentRecommendationStepProps) {
    const hireKey = `${userId}:${applicantId ?? ""}`;
    const [initialAssembled] = React.useState(assembled);
    const [initialEffectivity] = React.useState(effectivityDate ?? "");
    const [form, setForm] = React.useState<RecommendationFields>(() =>
        fieldsFromAssembled(initialAssembled, initialEffectivity)
    );
    const [logos, setLogos] = React.useState<CompanyLogoRow[]>([]);
    const [selectedLogoId, setSelectedLogoId] = React.useState("");
    const [logosError, setLogosError] = React.useState(false);
    const [logoDataUrl, setLogoDataUrl] = React.useState<string | null>(initialAssembled?.logoDataUrl ?? null);
    const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
    const [pdfFileName, setPdfFileName] = React.useState<string | null>(null);
    const [previewOpen, setPreviewOpen] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [savedNote, setSavedNote] = React.useState<string | null>(null);
    const [saving, setSaving] = React.useState(false);
    const [loadingSaved, setLoadingSaved] = React.useState(false);
    const [issuance, setIssuance] = React.useState<RecommendationIssuance | null>(null);
    const [issuanceLoading, setIssuanceLoading] = React.useState(true);
    const [issuanceFailed, setIssuanceFailed] = React.useState(false);
    const [issuanceNonce, setIssuanceNonce] = React.useState(0);
    const pdfUrlRef = React.useRef<string | null>(null);
    const issued = issuance?.issued === true;

    React.useEffect(() => {
        return () => {
            if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
        };
    }, []);

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/hrm/company-logos");
                if (!res.ok) {
                    if (!cancelled) setLogosError(true);
                    return;
                }
                const json = await res.json();
                if (cancelled) return;
                if (!Array.isArray(json.data) || json.data.length === 0) {
                    setLogosError(true);
                    return;
                }
                const rows: CompanyLogoRow[] = [];
                for (const entry of json.data as unknown[]) {
                    const row = parseCompanyRow(entry);
                    if (row) rows.push(row);
                }
                if (rows.length === 0) {
                    setLogosError(true);
                    return;
                }
                setLogos(rows);
                const current = initialAssembled?.input.companyName?.trim();
                if (current) {
                    const match = rows.find(
                        (r) => r.company_name.toLowerCase() === current.toLowerCase()
                    );
                    if (match) {
                        setSelectedLogoId(String(match.id));
                        if (!initialAssembled?.logoDataUrl) setLogoDataUrl(match.logo_data_url);
                        return;
                    }
                }
                const first = rows[0];
                if (first && !initialAssembled) {
                    setSelectedLogoId(String(first.id));
                    setLogoDataUrl(first.logo_data_url);
                    setForm((f) => ({
                        ...f,
                        companyName: first.company_name,
                        headerAddress: first.headerAddress ?? f.headerAddress,
                        headerContact: first.headerContact ?? f.headerContact,
                        headerEmail: first.headerEmail ?? f.headerEmail,
                    }));
                }
            } catch {
                if (!cancelled) setLogosError(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [initialAssembled]);

    const set = (key: keyof RecommendationFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value }));

    const issuanceQuery = applicantId ? `${RECOMMENDATION_URL}?user_id=${userId}&applicant_id=${applicantId}` : `${RECOMMENDATION_URL}?user_id=${userId}`;

    React.useEffect(() => {
        let cancelled = false;
        setIssuanceLoading(true);
        setIssuanceFailed(false);
        (async () => {
            try {
                const res = await fetch(issuanceQuery, { cache: "no-store" });
                const json: unknown = await res.json().catch(() => null);
                if (cancelled) return;
                if (!res.ok) throw new Error("issuance unavailable");
                setIssuance(parseIssuance((json as { issuance?: unknown } | null)?.issuance));
            } catch {
                if (!cancelled) setIssuanceFailed(true);
            } finally {
                if (!cancelled) setIssuanceLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [issuanceQuery, issuanceNonce]);

    const handleCompanyPick = (value: string) => {
        setSelectedLogoId(value);
        const row = logos.find((l) => String(l.id) === value);
        if (!row) return;
        setLogoDataUrl(row.logo_data_url);
        setForm((f) => ({
            ...f,
            companyName: row.company_name,
            headerAddress: row.headerAddress ?? f.headerAddress,
            headerContact: row.headerContact ?? f.headerContact,
            headerEmail: row.headerEmail ?? f.headerEmail,
        }));
    };

    const savedFileName = () => {
        const name = form.employeeName.trim() || "Employee";
        return `Recommendation-for-Employment-${name.replace(/\s+/g, "-")}.pdf`;
    };

    const ensureSavedPdf = async (): Promise<void> => {
        if (!issuance?.fileRef) throw new Error("The saved letter is unavailable. Generate the letter again.");
        const fileName = savedFileName();
        const res = await fetch(savedAssetUrl(issuance.fileRef, fileName), { cache: "no-store" });
        if (!res.ok) throw new Error("The saved letter could not be loaded. Please try again.");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = url;
        setPdfUrl(url);
        setPdfFileName(fileName);
    };

    const handleGenerateAndSave = async () => {
        if (saving) return;
        setSaving(true);
        setError(null);
        setSavedNote(null);
        try {
            const blob = buildEmploymentRecommendationPdf(toBuilderInput(form), logoDataUrl);
            if (blob.size > MAX_PDF_BYTES) {
                throw new Error("The generated letter exceeds the 10 MB save limit.");
            }
            const fileName = savedFileName();
            const pdfBase64 = await blobToBase64(blob);
            const res = await fetch(RECOMMENDATION_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: userId,
                    ...(applicantId ? { applicant_id: applicantId } : {}),
                    file_name: fileName,
                    pdf_base64: pdfBase64,
                }),
            });
            const json: unknown = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(readSaveMessage(json, "The letter was not saved. Please try again."));
            }
            const url = URL.createObjectURL(blob);
            if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
            pdfUrlRef.current = url;
            setPdfUrl(url);
            setPdfFileName(fileName);
            setIssuance(parseIssuance((json as { data?: unknown } | null)?.data) ?? {
                issued: true,
                fileRef: null,
                recordId: null,
                recordStatus: null,
            });
            setSavedNote("Letter generated and saved to the employee records.");
            setPreviewOpen(true);
            onGenerated?.({ blob, fileName, url });
        } catch (err) {
            setError(err instanceof Error ? err.message : "The letter was not saved. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleSavePrintable = async () => {
        if (loadingSaved) return;
        setLoadingSaved(true);
        setError(null);
        try {
            await ensureSavedPdf();
            setPreviewOpen(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "The saved letter could not be loaded. Please try again.");
        } finally {
            setLoadingSaved(false);
        }
    };

    const handleDownloadSaved = async () => {
        if (loadingSaved) return;
        setLoadingSaved(true);
        setError(null);
        try {
            await ensureSavedPdf();
            handleDownload();
        } catch (err) {
            setError(err instanceof Error ? err.message : "The saved letter could not be downloaded. Please try again.");
        } finally {
            setLoadingSaved(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl || !pdfFileName) return;
        const anchor = document.createElement("a");
        anchor.href = pdfUrl;
        anchor.download = pdfFileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
    };

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

    const viewUrl = pdfUrl ? toFitWidthUrl(pdfUrl) : null;
    const field = "w-full";
    const labelClass = "text-sm font-medium mb-1 block";
    const section = "text-xs font-bold uppercase tracking-wider text-muted-foreground pt-2";

    return (
        <div data-hire-key={hireKey} className="p-2 sm:p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen space-y-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-2xl shadow-sm border border-primary/20">
                        <FileBadge className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                            Recommendation for Employment
                        </h1>
                        <p className="text-muted-foreground/80 font-medium mt-1 text-base sm:text-lg">
                            {issued
                                ? "The issued letter is saved — re-open it for printing"
                                : "Review the details, then generate the letter"}
                        </p>
                    </div>
                </div>
                <div className="flex flex-col gap-2 w-full sm:w-auto sm:items-end">
                    {issued ? (
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                                onClick={() => void handleSavePrintable()}
                                className="w-full sm:w-auto"
                                type="button"
                                disabled={loadingSaved || issuanceLoading}
                            >
                                <Save className="mr-2 h-4 w-4" />
                                {loadingSaved ? "Loading…" : "Save + printable"}
                            </Button>
                            <Button
                                onClick={() => void handleDownloadSaved()}
                                variant="outline"
                                className="w-full sm:w-auto"
                                type="button"
                                disabled={loadingSaved || issuanceLoading}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Download
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                                onClick={() => void handleGenerateAndSave()}
                                className="w-full sm:w-auto"
                                type="button"
                                disabled={saving || issuanceLoading}
                            >
                                <Eye className="mr-2 h-4 w-4" />
                                {saving ? "Saving…" : "Generate and save letter"}
                            </Button>
                            <Button
                                onClick={() => setPreviewOpen(true)}
                                variant="outline"
                                className="w-full sm:w-auto"
                                type="button"
                                disabled={!pdfUrl}
                            >
                                <Eye className="mr-2 h-4 w-4" />
                                Preview
                            </Button>
                            <Button
                                onClick={handleDownload}
                                variant="outline"
                                className="w-full sm:w-auto"
                                type="button"
                                disabled={!pdfUrl}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Download
                            </Button>
                        </div>
                    )}
                    {pdfFileName ? (
                        <p
                            className="text-xs text-muted-foreground truncate max-w-full sm:max-w-[260px]"
                            title={pdfFileName}
                        >
                            {pdfFileName}
                        </p>
                    ) : null}
                    {savedNote ? <p className="text-xs text-green-700">{savedNote}</p> : null}
                    {error ? <p className="text-xs text-destructive">{error}</p> : null}
                </div>
            </div>

            {issued ? (
                <div className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
                    <div>
                        <p className="text-sm font-semibold">Recommendation letter issued and saved</p>
                        <p className="text-sm text-muted-foreground">
                            The saved letter is filed to the employee records and can be re-opened for printing or downloading at any time.
                        </p>
                    </div>
                </div>
            ) : null}
            {issuanceFailed && !issued ? (
                <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-muted-foreground">Could not check whether a saved letter exists.</p>
                    <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => setIssuanceNonce((n) => n + 1)}
                        disabled={issuanceLoading}
                    >
                        Retry
                    </Button>
                </div>
            ) : null}

            <div className="bg-card shadow-sm border rounded-xl p-6 space-y-4 max-w-[720px]">
                <p className={section}>Employee</p>
                <div>
                    <Label className={labelClass} htmlFor="rec-employee-name">Employee name</Label>
                    <Input
                        id="rec-employee-name"
                        className={field}
                        value={form.employeeName}
                        onChange={set("employeeName")}
                        placeholder="JUAN D. DELA CRUZ"
                    />
                </div>
                <div>
                    <Label className={labelClass} htmlFor="rec-employee-address">Address line</Label>
                    <Input
                        id="rec-employee-address"
                        className={field}
                        value={form.employeeAddress}
                        onChange={set("employeeAddress")}
                        placeholder="#123 Rizal St., Dagupan City, Pangasinan"
                    />
                </div>
                <div>
                    <Label className={labelClass} htmlFor="rec-salutation">Salutation (Dear ...)</Label>
                    <Input
                        id="rec-salutation"
                        className={field}
                        value={form.salutationName}
                        onChange={set("salutationName")}
                        placeholder="Mr. Dela Cruz"
                    />
                </div>

                <p className={section}>Letter</p>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label className={labelClass} htmlFor="rec-letter-date">Letter date</Label>
                        <Input
                            id="rec-letter-date"
                            className={field}
                            type="date"
                            value={form.letterDate}
                            onChange={set("letterDate")}
                        />
                    </div>
                    <div>
                        <Label className={labelClass} htmlFor="rec-effectivity-date">Effectivity date</Label>
                        <Input
                            id="rec-effectivity-date"
                            className={field}
                            type="date"
                            value={form.effectivityDate}
                            onChange={set("effectivityDate")}
                        />
                    </div>
                </div>
                <div>
                    <Label className={labelClass} htmlFor="rec-position">Position</Label>
                    <Input
                        id="rec-position"
                        className={field}
                        value={form.position}
                        onChange={set("position")}
                        placeholder="Territory Sales Manager"
                    />
                </div>
                <div>
                    <Label className={labelClass} htmlFor="rec-department">Department</Label>
                    <Input
                        id="rec-department"
                        className={field}
                        value={form.department}
                        onChange={set("department")}
                        placeholder="Sales"
                    />
                </div>
                <div>
                    <Label className={labelClass} htmlFor="rec-probation">Probation statement</Label>
                    <Input
                        id="rec-probation"
                        className={field}
                        value={form.probationText}
                        onChange={set("probationText")}
                        placeholder="six months (180 days)"
                    />
                </div>
                <div>
                    <Label className={labelClass} htmlFor="rec-company">Company</Label>
                    <Select
                        value={selectedLogoId}
                        onValueChange={handleCompanyPick}
                        disabled={logos.length === 0}
                    >
                        <SelectTrigger id="rec-company" className={field}>
                            <SelectValue
                                placeholder={
                                    logosError
                                        ? "Company list unavailable — using default"
                                        : logos.length === 0
                                          ? "Loading companies..."
                                          : "Pick a company"
                                }
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {logos.map((logo) => (
                                <SelectItem key={logo.id} value={String(logo.id)}>
                                    {logo.company_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label className={labelClass} htmlFor="rec-header-address">Letterhead address</Label>
                    <Input
                        id="rec-header-address"
                        className={field}
                        value={form.headerAddress}
                        onChange={set("headerAddress")}
                    />
                </div>
                <div>
                    <Label className={labelClass} htmlFor="rec-header-contact">Letterhead contact</Label>
                    <Input
                        id="rec-header-contact"
                        className={field}
                        value={form.headerContact}
                        onChange={set("headerContact")}
                    />
                </div>
                <div>
                    <Label className={labelClass} htmlFor="rec-header-email">Letterhead email</Label>
                    <Input
                        id="rec-header-email"
                        className={field}
                        value={form.headerEmail}
                        onChange={set("headerEmail")}
                    />
                </div>

                <p className={section}>Signatories</p>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label className={labelClass} htmlFor="rec-prepared-name">Prepared by — name</Label>
                        <Input
                            id="rec-prepared-name"
                            className={field}
                            value={form.preparedByName}
                            onChange={set("preparedByName")}
                            placeholder="JANE D. SANTOS"
                        />
                    </div>
                    <div>
                        <Label className={labelClass} htmlFor="rec-prepared-title">Prepared by — title</Label>
                        <Input
                            id="rec-prepared-title"
                            className={field}
                            value={form.preparedByTitle}
                            onChange={set("preparedByTitle")}
                            placeholder="HR Officer"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label className={labelClass} htmlFor="rec-noted-name">Noted by — name</Label>
                        <Input
                            id="rec-noted-name"
                            className={field}
                            value={form.notedByName}
                            onChange={set("notedByName")}
                            placeholder="JOHN M. REYES"
                        />
                    </div>
                    <div>
                        <Label className={labelClass} htmlFor="rec-noted-title">Noted by — title</Label>
                        <Input
                            id="rec-noted-title"
                            className={field}
                            value={form.notedByTitle}
                            onChange={set("notedByTitle")}
                            placeholder="HR Supervisor"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label className={labelClass} htmlFor="rec-approved-name">Approved by — name</Label>
                        <Input
                            id="rec-approved-name"
                            className={field}
                            value={form.approvedByName}
                            onChange={set("approvedByName")}
                            placeholder="MARIA L. GARCIA"
                        />
                    </div>
                    <div>
                        <Label className={labelClass} htmlFor="rec-approved-title">Approved by — title</Label>
                        <Input
                            id="rec-approved-title"
                            className={field}
                            value={form.approvedByTitle}
                            onChange={set("approvedByTitle")}
                            placeholder="HR Manager"
                        />
                    </div>
                </div>

                <p className={section}>Acknowledgement</p>
                <div>
                    <Label className={labelClass} htmlFor="rec-ack-name">Employee printed name</Label>
                    <Input
                        id="rec-ack-name"
                        className={field}
                        value={form.acknowledgementName}
                        onChange={set("acknowledgementName")}
                        placeholder="JUAN D. DELA CRUZ"
                    />
                </div>
                <div>
                    <Label className={labelClass} htmlFor="rec-ack-label">Acknowledgement label</Label>
                    <Input
                        id="rec-ack-label"
                        className={field}
                        value={form.acknowledgementLabel}
                        onChange={set("acknowledgementLabel")}
                        placeholder="Acknowledged by:"
                    />
                </div>
            </div>

            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 sm:max-w-4xl lg:max-w-5xl">
                    <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6">
                        <DialogTitle className="text-base">Recommendation for employment</DialogTitle>
                        <DialogDescription className="truncate text-xs" title={pdfFileName ?? undefined}>
                            {pdfFileName}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto bg-muted/60 p-3 sm:p-6">
                        {pdfUrl ? (
                            <div className="mx-auto max-w-3xl overflow-hidden rounded-[var(--radius)] border bg-card shadow-md">
                                <iframe
                                    src={viewUrl ?? pdfUrl}
                                    className="h-[68vh] w-full border-0 sm:h-[72vh]"
                                    title="Recommendation for employment preview"
                                />
                            </div>
                        ) : (
                            <div className="mx-auto flex max-w-3xl items-center justify-center rounded-[var(--radius)] border bg-card px-4 py-16 shadow-sm">
                                <p className="text-center text-sm text-muted-foreground">
                                    Preview unavailable. Generate the letter again.
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
                            type="button"
                        >
                            <Printer className="h-4 w-4" aria-hidden="true" />
                            Print
                        </Button>
                        <Button
                            onClick={handleDownload}
                            disabled={!pdfUrl}
                            className="w-full sm:w-auto"
                            type="button"
                        >
                            <Download className="h-4 w-4" aria-hidden="true" />
                            Download PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default EmploymentRecommendationStep;
