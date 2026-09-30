"use client";

import React from "react";
import { Download, Eye, FileText, Printer } from "lucide-react";
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
import { buildPreEmploymentTrainingPdf } from "../utils/preEmploymentTrainingPdf";
import {
    EMPTY_PRE_EMPLOYMENT_TRAINING,
    type GeneratedTrainingLetter,
    type PreEmploymentTrainingFormData,
    type PreEmploymentTrainingLetterFormProps,
} from "./types";

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

function formatAllowance(input: string): string {
    const n = Number(input.replace(/[^0-9.]/g, ""));
    if (!input.trim() || Number.isNaN(n)) return "";
    return `Php ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per day`;
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
    const logo = nonEmptyString(record.logo_data_url);
    return {
        id,
        company_name: name,
        logo_data_url: logo,
        headerAddress: nonEmptyString(record.company_address),
        headerContact: nonEmptyString(record.company_contact),
        headerEmail: nonEmptyString(record.company_email),
    };
}

function applyPrefill(
    base: PreEmploymentTrainingFormData,
    prefill: PreEmploymentTrainingLetterFormProps["prefill"]
): PreEmploymentTrainingFormData {
    if (!prefill) return base;
    return {
        ...base,
        applicantName: prefill.applicantName ?? base.applicantName,
        applicantAddress: prefill.applicantAddress ?? base.applicantAddress,
        position: prefill.position ?? base.position,
        companyName: prefill.companyName ?? base.companyName,
        headerAddress: prefill.headerAddress ?? base.headerAddress,
        headerContact: prefill.headerContact ?? base.headerContact,
        headerEmail: prefill.headerEmail ?? base.headerEmail,
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

export function PreEmploymentTrainingLetterForm({ prefill, onGenerated }: PreEmploymentTrainingLetterFormProps) {
    const [form, setForm] = React.useState<PreEmploymentTrainingFormData>(() => ({
        ...applyPrefill(EMPTY_PRE_EMPLOYMENT_TRAINING, prefill),
        letterDate: todayInputValue(),
    }));
    const [logos, setLogos] = React.useState<CompanyLogoRow[]>([]);
    const [selectedLogoId, setSelectedLogoId] = React.useState("");
    const [logosError, setLogosError] = React.useState(false);
    const [prefillLogo, setPrefillLogo] = React.useState<string | null>(prefill?.logoDataUrl ?? null);
    const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
    const [pdfFileName, setPdfFileName] = React.useState<string | null>(null);
    const [previewOpen, setPreviewOpen] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const pdfUrlRef = React.useRef<string | null>(null);
    const prefillCompanyRef = React.useRef(prefill?.companyName);

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
                const prefillCompany = prefillCompanyRef.current?.trim();
                if (prefillCompany) {
                    const match = rows.find(
                        (r) => r.company_name.toLowerCase() === prefillCompany.toLowerCase()
                    );
                    if (match) {
                        setSelectedLogoId(String(match.id));
                        setPrefillLogo(match.logo_data_url);
                        setForm((f) => ({ ...f, companyId: match.id, companyName: match.company_name }));
                    }
                    return;
                }
                const first = rows[0];
                setSelectedLogoId(String(first.id));
                setPrefillLogo(first.logo_data_url);
                setForm((f) => ({
                    ...f,
                    companyId: first.id,
                    companyName: first.company_name,
                    headerAddress: first.headerAddress ?? f.headerAddress,
                    headerContact: first.headerContact ?? f.headerContact,
                    headerEmail: first.headerEmail ?? f.headerEmail,
                }));
            } catch {
                if (!cancelled) setLogosError(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const set = (key: keyof PreEmploymentTrainingFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value }));

    const handleCompanyPick = (value: string) => {
        setSelectedLogoId(value);
        const row = logos.find((l) => String(l.id) === value);
        if (!row) return;
        setPrefillLogo(row.logo_data_url);
        setForm((f) => ({
            ...f,
            companyId: row.id,
            companyName: row.company_name,
            headerAddress: row.headerAddress ?? "",
            headerContact: row.headerContact ?? "",
            headerEmail: row.headerEmail ?? "",
        }));
    };

    const handleGenerate = () => {
        setError(null);
        try {
            const blob = buildPreEmploymentTrainingPdf(
                {
                    applicantName: form.applicantName,
                    applicantAddress: form.applicantAddress,
                    salutationName: form.salutationName,
                    position: form.position,
                    companyName: form.companyName,
                    letterDate: form.letterDate,
                    headerAddress: form.headerAddress,
                    headerContact: form.headerContact,
                    headerEmail: form.headerEmail,
                    scheduleText: form.scheduleText,
                    durationText: form.durationText,
                    startDate: form.startDate,
                    endDate: form.endDate,
                    reportingTo: form.reportingTo,
                    allowanceText: formatAllowance(form.allowance),
                    preparedBy: { name: form.preparedByName, title: form.preparedByTitle },
                    notedBy: { name: form.notedByName, title: form.notedByTitle },
                    approvedBy: { name: form.approvedByName, title: form.approvedByTitle },
                    trainee: { label: form.traineeLabel, printedName: form.traineeName },
                },
                prefillLogo
            );
            const name = form.applicantName.trim() || "Trainee";
            const fileName = `Pre-Employment-Training-${name.replace(/\s+/g, "-")}.pdf`;
            const url = URL.createObjectURL(blob);
            if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
            pdfUrlRef.current = url;
            setPdfUrl(url);
            setPdfFileName(fileName);
            setPreviewOpen(true);
            const result: GeneratedTrainingLetter = { blob, fileName, url };
            onGenerated?.(result, { ...form });
        } catch {
            setError("Failed to generate the training letter PDF.");
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
        <div className="p-2 sm:p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen space-y-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-2xl shadow-sm border border-primary/20">
                        <FileText className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                            Pre-Employment Training Letter
                        </h1>
                        <p className="text-muted-foreground/80 font-medium mt-1 text-base sm:text-lg">
                            Fill in the training details
                        </p>
                    </div>
                </div>
                <div className="flex flex-col gap-2 w-full sm:w-auto sm:items-end">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Button onClick={handleGenerate} className="w-full sm:w-auto" type="button">
                            <Eye className="mr-2 h-4 w-4" />
                            Generate letter
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
                    {pdfFileName ? (
                        <p
                            className="text-xs text-muted-foreground truncate max-w-full sm:max-w-[260px]"
                            title={pdfFileName}
                        >
                            {pdfFileName}
                        </p>
                    ) : null}
                    {error ? <p className="text-xs text-destructive">{error}</p> : null}
                </div>
            </div>

            <div className="bg-card shadow-sm border rounded-xl p-6 space-y-4 max-w-[720px]">
                <p className={section}>Recipient</p>
                <div>
                    <Label className={labelClass} htmlFor="pet-applicant-name">Applicant name</Label>
                    <Input
                        id="pet-applicant-name"
                        className={field}
                        value={form.applicantName}
                        onChange={set("applicantName")}
                        placeholder="JUAN D. DELA CRUZ"
                    />
                </div>
                <div>
                    <Label className={labelClass} htmlFor="pet-applicant-address">Address line</Label>
                    <Input
                        id="pet-applicant-address"
                        className={field}
                        value={form.applicantAddress}
                        onChange={set("applicantAddress")}
                        placeholder="#123 Rizal St., Dagupan City, Pangasinan"
                    />
                </div>
                <div>
                    <Label className={labelClass} htmlFor="pet-salutation">Salutation (Dear ...)</Label>
                    <Input
                        id="pet-salutation"
                        className={field}
                        value={form.salutationName}
                        onChange={set("salutationName")}
                        placeholder="Mr. Dela Cruz"
                    />
                </div>

                <p className={section}>Letter</p>
                <div>
                    <Label className={labelClass} htmlFor="pet-letter-date">Letter date</Label>
                    <Input
                        id="pet-letter-date"
                        className={field}
                        type="date"
                        value={form.letterDate}
                        onChange={set("letterDate")}
                    />
                </div>
                <div>
                    <Label className={labelClass} htmlFor="pet-position">Position</Label>
                    <Input
                        id="pet-position"
                        className={field}
                        value={form.position}
                        onChange={set("position")}
                        placeholder="Territory Sales Manager"
                    />
                </div>
                <div>
                    <Label className={labelClass} htmlFor="pet-company">Company</Label>
                    <Select
                        value={selectedLogoId}
                        onValueChange={handleCompanyPick}
                        disabled={logos.length === 0}
                    >
                        <SelectTrigger id="pet-company" className={field}>
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
                    <Label className={labelClass} htmlFor="pet-header-address">Letterhead address</Label>
                    <Input
                        id="pet-header-address"
                        className={field}
                        value={form.headerAddress}
                        onChange={set("headerAddress")}
                    />
                </div>
                <div>
                    <Label className={labelClass} htmlFor="pet-header-contact">Letterhead contact</Label>
                    <Input
                        id="pet-header-contact"
                        className={field}
                        value={form.headerContact}
                        onChange={set("headerContact")}
                    />
                </div>
                <div>
                    <Label className={labelClass} htmlFor="pet-header-email">Letterhead email</Label>
                    <Input
                        id="pet-header-email"
                        className={field}
                        value={form.headerEmail}
                        onChange={set("headerEmail")}
                    />
                </div>

                <p className={section}>Training details</p>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label className={labelClass} htmlFor="pet-start-date">Start date <span aria-hidden="true">*</span><span className="sr-only"> (required)</span></Label>
                        <Input
                            id="pet-start-date"
                            className={field}
                            type="date"
                            value={form.startDate}
                            onChange={set("startDate")}
                            required
                            aria-required="true"
                        />
                    </div>
                    <div>
                        <Label className={labelClass} htmlFor="pet-end-date">End date <span aria-hidden="true">*</span><span className="sr-only"> (required)</span></Label>
                        <Input
                            id="pet-end-date"
                            className={field}
                            type="date"
                            value={form.endDate}
                            onChange={set("endDate")}
                            required
                            aria-required="true"
                        />
                    </div>
                </div>
                <div>
                    <Label className={labelClass} htmlFor="pet-reporting-to">Reporting to</Label>
                    <Input
                        id="pet-reporting-to"
                        className={field}
                        value={form.reportingTo}
                        onChange={set("reportingTo")}
                        placeholder="Immediate Superior / Department Head"
                    />
                </div>
                <div>
                    <Label className={labelClass} htmlFor="pet-allowance">Training allowance (₱)</Label>
                    <Input
                        id="pet-allowance"
                        className={field}
                        inputMode="decimal"
                        value={form.allowance}
                        onChange={(e) =>
                            setForm((f) => ({ ...f, allowance: e.target.value.replace(/[^0-9.]/g, "") }))
                        }
                        placeholder="5000"
                    />
                </div>
                <div>
                    <Label className={labelClass} htmlFor="pet-schedule">Schedule</Label>
                    <Input
                        id="pet-schedule"
                        className={field}
                        value={form.scheduleText}
                        onChange={set("scheduleText")}
                    />
                </div>
                <div>
                    <Label className={labelClass} htmlFor="pet-duration">Duration</Label>
                    <Input
                        id="pet-duration"
                        className={field}
                        value={form.durationText}
                        onChange={set("durationText")}
                    />
                </div>

                <p className={section}>Signatories</p>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label className={labelClass} htmlFor="pet-prepared-name">Prepared by — name</Label>
                        <Input
                            id="pet-prepared-name"
                            className={field}
                            value={form.preparedByName}
                            onChange={set("preparedByName")}
                            placeholder="JANE D. SANTOS"
                        />
                    </div>
                    <div>
                        <Label className={labelClass} htmlFor="pet-prepared-title">Prepared by — title</Label>
                        <Input
                            id="pet-prepared-title"
                            className={field}
                            value={form.preparedByTitle}
                            onChange={set("preparedByTitle")}
                            placeholder="HR Officer"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label className={labelClass} htmlFor="pet-noted-name">Noted by — name</Label>
                        <Input
                            id="pet-noted-name"
                            className={field}
                            value={form.notedByName}
                            onChange={set("notedByName")}
                            placeholder="JOHN M. REYES"
                        />
                    </div>
                    <div>
                        <Label className={labelClass} htmlFor="pet-noted-title">Noted by — title</Label>
                        <Input
                            id="pet-noted-title"
                            className={field}
                            value={form.notedByTitle}
                            onChange={set("notedByTitle")}
                            placeholder="HR Supervisor"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label className={labelClass} htmlFor="pet-approved-name">Approved by — name</Label>
                        <Input
                            id="pet-approved-name"
                            className={field}
                            value={form.approvedByName}
                            onChange={set("approvedByName")}
                            placeholder="MARIA L. GARCIA"
                        />
                    </div>
                    <div>
                        <Label className={labelClass} htmlFor="pet-approved-title">Approved by — title</Label>
                        <Input
                            id="pet-approved-title"
                            className={field}
                            value={form.approvedByTitle}
                            onChange={set("approvedByTitle")}
                            placeholder="HR Manager"
                        />
                    </div>
                </div>

                <p className={section}>Trainee</p>
                <div>
                    <Label className={labelClass} htmlFor="pet-trainee-name">Trainee printed name</Label>
                    <Input
                        id="pet-trainee-name"
                        className={field}
                        value={form.traineeName}
                        onChange={set("traineeName")}
                        placeholder="JUAN D. DELA CRUZ"
                    />
                </div>
                <div>
                    <Label className={labelClass} htmlFor="pet-trainee-label">Acknowledgement label</Label>
                    <Input
                        id="pet-trainee-label"
                        className={field}
                        value={form.traineeLabel}
                        onChange={set("traineeLabel")}
                        placeholder="Conforme:"
                    />
                </div>
            </div>

            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 sm:max-w-4xl lg:max-w-5xl">
                    <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6">
                        <DialogTitle className="text-base">Pre-employment training letter</DialogTitle>
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
                                    title="Pre-employment training letter preview"
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

export default PreEmploymentTrainingLetterForm;
