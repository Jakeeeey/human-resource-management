"use client";

import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Check, Loader2, Lock, Minus, Plus, Printer, Upload } from "lucide-react";
import { QuitClaimPrintDialog } from "./QuitClaimPrintDialog";
import { QuitClaimCompanySelect } from "./QuitClaimCompanySelect";
import { QuitClaimLivePreview } from "./QuitClaimLivePreview";
import type { CompanyOption } from "../../utils/company";
import { companyLogoDataUrl, fetchEmployeeCompany, pickEmployeeCompany } from "../../utils/company";
import { phToday } from "../../utils/time";
import { buildQuitClaimPdf, type QuitClaimCompany } from "../utils/quitClaimPrintPdf";
import { freezeApprovedQuitClaimPdf } from "../utils/approvedPdfFreeze";
import {
    approveQuitClaim,
    findCompanyByCode,
    getQuitClaim,
    isAlreadyApprovedError,
    loadCompanyOptions,
    normalizeQuitClaimValues,
    quitClaimErrorMessage,
    updateQuitClaimValues,
    type ClearanceQuitclaim,
    type QuitClaimDetail,
} from "../providers/quitClaimClient";
import type {
    QuitClaimAccountability,
    QuitClaimDeduction,
    QuitClaimDueToEmployee,
    QuitClaimValues,
} from "../types";

interface QuitClaimEditorProps {
    quitclaimId: number | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onChanged: (row: ClearanceQuitclaim) => void;
    autoOpenPrint?: boolean;
}

function Field({
    id,
    label,
    value,
    onChange,
    disabled,
    placeholder,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (next: string) => void;
    disabled: boolean;
    placeholder?: string;
}): JSX.Element {
    return (
        <div className="space-y-1">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                value={value}
                placeholder={placeholder ?? ""}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
            />
        </div>
    );
}

function RowPager({
    navLabel,
    page,
    totalPages,
    start,
    end,
    total,
    onPageChange,
}: {
    navLabel: string;
    page: number;
    totalPages: number;
    start: number;
    end: number;
    total: number;
    onPageChange: (page: number) => void;
}): JSX.Element | null {
    if (totalPages <= 1) {
        return null;
    }
    return (
        <nav aria-label={navLabel} className="flex flex-wrap items-center justify-between gap-2 py-1">
            <p className="text-xs text-muted-foreground">Showing {start}–{end} of {total}</p>
            <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                    Previous
                </Button>
                <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
                <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
                    Next
                </Button>
            </div>
        </nav>
    );
}

function blankAccountability(): QuitClaimAccountability {
    return { outlet: "", name: "", date: "", remarks: "" };
}

function blankDeduction(): QuitClaimDeduction {
    return { label: "", amount: "" };
}

function blankDueToEmployee(): QuitClaimDueToEmployee {
    return { item: "", days: "", amount: "" };
}

function toUploadFileName(employeeName: string): string {
    const cleaned = employeeName
        .split("")
        .filter((ch) => ch >= " " && !"<>:\"/\\|?*".includes(ch))
        .join("")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
    const who = cleaned === "" ? "Employee" : cleaned;
    return `Quit Claim - ${who} - ${phToday()}.pdf`;
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

const ROW_PAGE_SIZE = 10;

function matchesRowFilter(entry: unknown, query: string): boolean {
    const needle = query.trim().toLowerCase();
    if (needle === "") return true;
    return JSON.stringify(entry).toLowerCase().includes(needle);
}

function pageSlice<T>(rows: T[], page: number): { pageRows: T[]; totalPages: number; safePage: number; start: number; end: number } {
    const totalPages = Math.max(1, Math.ceil(rows.length / ROW_PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * ROW_PAGE_SIZE;
    const pageRows = rows.slice(start, start + ROW_PAGE_SIZE);
    return {
        pageRows,
        totalPages,
        safePage,
        start: rows.length === 0 ? 0 : start + 1,
        end: Math.min(start + ROW_PAGE_SIZE, rows.length),
    };
}

export function QuitClaimEditor({ quitclaimId, open, onChanged, autoOpenPrint = false }: QuitClaimEditorProps): JSX.Element {
    const [row, setRow] = useState<ClearanceQuitclaim | null>(null);
    const [values, setValues] = useState<QuitClaimValues | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [approving, setApproving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [printOpen, setPrintOpen] = useState(false);
    const [detail, setDetail] = useState<QuitClaimDetail | null>(null);
    const [company, setCompany] = useState<CompanyOption | null>(null);
    const [editCount, setEditCount] = useState(0);
    const baselineRef = useRef<string | null>(null);
    const [accountabilityFilter, setAccountabilityFilter] = useState("");
    const [accountabilityPage, setAccountabilityPage] = useState(1);
    const [deductionFilter, setDeductionFilter] = useState("");
    const [deductionPage, setDeductionPage] = useState(1);
    const [dueFilter, setDueFilter] = useState("");
    const [duePage, setDuePage] = useState(1);
    const autoPrintFiredRef = useRef<number | null>(null);

    const frozen = row?.status === "approved";
    const dirty = values !== null && baselineRef.current !== null && JSON.stringify(values) !== baselineRef.current;
    const hasUpload = (row?.pdf_file ?? "") !== "";
    const approveBlockedReason = hasUpload
        ? null
        : "Upload the quit claim PDF to the 201 file before approving.";

    useEffect(() => {
        if (!open || quitclaimId === null) {
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        setSaved(false);
        setRow(null);
        setValues(null);
        setDetail(null);
        setCompany(null);
        setEditCount(0);
        setAccountabilityFilter("");
        setAccountabilityPage(1);
        setDeductionFilter("");
        setDeductionPage(1);
        setDueFilter("");
        setDuePage(1);
        baselineRef.current = null;
        (async () => {
            try {
                const loaded = await getQuitClaim(quitclaimId);
                if (cancelled) {
                    return;
                }
                const normalized = normalizeQuitClaimValues(loaded.values);
                let letterhead: CompanyOption | null = null;
                try {
                    const [options, employee] = await Promise.all([
                        loadCompanyOptions(),
                        fetchEmployeeCompany({ userId: loaded.user_id }),
                    ]);
                    if (cancelled) {
                        return;
                    }
                    letterhead = findCompanyByCode(options, normalized.letterhead_company_code)
                        ?? pickEmployeeCompany(options, employee.company_id);
                } catch {
                    letterhead = null;
                }
                if (cancelled) {
                    return;
                }
                let seeded = normalized;
                if (seeded.identity.company.trim() === "" && letterhead !== null) {
                    seeded = { ...seeded, identity: { ...seeded.identity, company: letterhead.company_name } };
                }
                if (letterhead !== null && seeded.letterhead_company_code !== letterhead.company_code) {
                    seeded = { ...seeded, letterhead_company_code: letterhead.company_code };
                }
                if (!cancelled) {
                    setRow(loaded);
                    setValues(seeded);
                    setDetail({ ...loaded, values: seeded });
                    setCompany(letterhead);
                    baselineRef.current = JSON.stringify(seeded);
                    setEditCount(0);
                }
            } catch (loadError) {
                if (!cancelled) {
                    setError(quitClaimErrorMessage(loadError, "Failed to load the quit claim."));
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, quitclaimId]);

    useEffect(() => {
        if (!open || !autoOpenPrint || quitclaimId === null || detail === null) return;
        if (autoPrintFiredRef.current === quitclaimId) return;
        autoPrintFiredRef.current = quitclaimId;
        setPrintOpen(true);
    }, [open, autoOpenPrint, quitclaimId, detail]);

    function patch(patchValues: Partial<QuitClaimValues>): void {
        setValues((current) => (current === null ? current : { ...current, ...patchValues }));
        setEditCount((count) => count + 1);
        setSaved(false);
    }

    function handleCompanyChange(next: CompanyOption | null): void {
        setCompany(next);
        if (next === null || values === null || frozen) return;
        if (values.letterhead_company_code === next.company_code) return;
        patch({ letterhead_company_code: next.company_code });
    }

    async function handleSave(): Promise<void> {
        if (row === null || values === null || saving || frozen) {
            return;
        }
        setSaving(true);
        setError(null);
        setSaved(false);
        try {
            const updated = await updateQuitClaimValues(row.id, values);
            setRow(updated);
            const normalized = normalizeQuitClaimValues(updated.values);
            setValues(normalized);
            setDetail({ ...updated, values: normalized });
            baselineRef.current = JSON.stringify(normalized);
            setEditCount(0);
            setSaved(true);
            onChanged(updated);
        } catch (saveError) {
            if (isAlreadyApprovedError(saveError)) {
                setError("This quit claim is already approved. Approved documents are frozen and cannot be edited.");
                try {
                    const reloaded = await getQuitClaim(row.id);
                    setRow(reloaded);
                    const reloadedValues = normalizeQuitClaimValues(reloaded.values);
                    setValues(reloadedValues);
                    baselineRef.current = JSON.stringify(reloadedValues);
                    setEditCount(0);
                    onChanged(reloaded);
                } catch {
                    setRow({ ...row, status: "approved" });
                }
            } else {
                setError(quitClaimErrorMessage(saveError, "Failed to save the quit claim."));
            }
        } finally {
            setSaving(false);
        }
    }

    async function handleUpload(): Promise<void> {
        if (row === null || values === null || uploading || frozen) {
            return;
        }
        setUploading(true);
        setError(null);
        try {
            const bytes = buildQuitClaimPdf(values, toRendererCompany(company));
            await freezeApprovedQuitClaimPdf({
                documentId: row.id,
                bytes,
                fileName: toUploadFileName(values.identity.name),
            });
            const reloaded = await getQuitClaim(row.id);
            setRow(reloaded);
            setDetail({ ...reloaded, values });
            onChanged(reloaded);
        } catch (uploadError) {
            setError(quitClaimErrorMessage(uploadError, "Could not upload the quit claim PDF to the 201 file."));
        } finally {
            setUploading(false);
        }
    }

    async function handleApprove(): Promise<void> {
        if (row === null || values === null || approving || frozen) {
            return;
        }
        if (!hasUpload) {
            setError(approveBlockedReason ?? "Upload the quit claim PDF to the 201 file before approving.");
            return;
        }
        const companyCode = company?.company_code ?? row.company_code ?? "";
        if (companyCode === "") {
            setError("Choose a letterhead company before approving.");
            return;
        }
        setApproving(true);
        setError(null);
        try {
            const result = await approveQuitClaim(row.id, companyCode);
            setRow(result.quitclaim);
            setDetail({ ...result.quitclaim, values });
            onChanged(result.quitclaim);
        } catch (approveError) {
            setError(quitClaimErrorMessage(approveError, "Failed to approve the quit claim."));
        } finally {
            setApproving(false);
        }
    }

    const accountabilityRows = (values?.accountabilities ?? [])
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => matchesRowFilter(entry, accountabilityFilter));
    const accountabilityView = pageSlice(accountabilityRows, accountabilityPage);
    const deductionRows = (values?.deductions ?? [])
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => matchesRowFilter(entry, deductionFilter));
    const deductionView = pageSlice(deductionRows, deductionPage);
    const dueRows = (values?.due_to_employee ?? [])
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => matchesRowFilter(entry, dueFilter));
    const dueView = pageSlice(dueRows, duePage);
    const visibleSignatories = (values?.section2_signatories ?? [])
        .filter((entry) => entry.label !== "Amount Verified By");

    if (quitclaimId === null || !open) {
        return <></>;
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">
                        {row?.ref_no ? `Quit claim · ${row.ref_no}` : "Quit claim"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {frozen
                            ? "This document is approved and frozen. It is read-only."
                            : "All fields are manual entry. Nothing is computed."}
                    </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                        variant="outline"
                        className="min-h-11 w-full sm:w-auto md:min-h-0"
                        disabled={detail === null || loading}
                        onClick={() => setPrintOpen(true)}
                    >
                        <Printer className="h-4 w-4" aria-hidden="true" />
                        Print / Download
                    </Button>
                    {!frozen && (
                        <Button
                            variant="outline"
                            className="min-h-11 w-full sm:w-auto md:min-h-0"
                            disabled={values === null || loading || uploading}
                            onClick={() => void handleUpload()}
                        >
                            {uploading
                                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                : <Upload className="h-4 w-4" aria-hidden="true" />}
                            {uploading ? "Uploading…" : hasUpload ? "Re-upload to 201" : "Upload to 201"}
                        </Button>
                    )}
                    {!frozen && (
                        <span title={approveBlockedReason ?? undefined}>
                            <Button
                                className="min-h-11 w-full sm:w-auto md:min-h-0"
                                disabled={values === null || loading || approving || !hasUpload}
                                onClick={() => void handleApprove()}
                            >
                                {approving
                                    ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                    : <Check className="h-4 w-4" aria-hidden="true" />}
                                {approving ? "Approving…" : "Approve"}
                            </Button>
                        </span>
                    )}
                    {!frozen && (
                        <Button
                            className="min-h-11 w-full sm:w-auto md:min-h-0"
                            disabled={values === null || loading || saving || frozen || !dirty}
                            onClick={() => void handleSave()}
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                            {saving ? "Saving…" : dirty && editCount > 0 ? `Save (${editCount})` : "Save"}
                        </Button>
                    )}
                </div>
            </div>
            {!frozen && !hasUpload && (
                <p className="text-xs text-muted-foreground">
                    Upload the quit claim PDF to the 201 file to enable approval.
                </p>
            )}
            {!frozen && hasUpload && (
                <p className="text-xs text-muted-foreground">
                    Quit claim PDF filed to the 201 file. Re-upload replaces the filed copy.
                </p>
            )}
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    <AlertTitle>{frozen ? "Already approved" : "Could not save"}</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {saved && !error && (
                <Alert>
                    <AlertDescription>Saved.</AlertDescription>
                </Alert>
            )}
            {frozen && (
                <Alert>
                    <Lock className="h-4 w-4" aria-hidden="true" />
                    <AlertTitle>Approved{row?.ref_no ? ` · ${row.ref_no}` : ""}</AlertTitle>
                    <AlertDescription>
                        This quit claim is frozen. Values, totals, and signatories cannot be changed.
                    </AlertDescription>
                </Alert>
            )}
            {loading || values === null ? (
                <div className="flex items-center justify-center gap-3 py-16">
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">Loading quit claim…</p>
                </div>
            ) : (
                <div className="grid gap-6 lg:grid-cols-[520px_minmax(0,1fr)] xl:grid-cols-[560px_minmax(0,1fr)] items-start">
                    <div className="bg-card shadow-sm border rounded-xl p-6 space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="quitclaim-editor-company">Letterhead company</Label>
                            <QuitClaimCompanySelect
                                id="quitclaim-editor-company"
                                value={company}
                                onValueChange={handleCompanyChange}
                                disabled={loading || saving}
                            />
                        </div>
                        <section className="space-y-3 rounded-md border p-4" aria-label="Section 1 identity">
                            <h3 className="text-sm font-semibold">Section 1 — Employee clearance</h3>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Field
                                    id="qc-date"
                                    label="Date"
                                    value={values.identity.date}
                                    disabled={frozen || saving}
                                    onChange={(next) => patch({ identity: { ...values.identity, date: next } })}
                                />
                                <Field
                                    id="qc-name"
                                    label="Name"
                                    value={values.identity.name}
                                    disabled={frozen || saving}
                                    onChange={(next) => patch({ identity: { ...values.identity, name: next } })}
                                />
                                <Field
                                    id="qc-position"
                                    label="Position"
                                    value={values.identity.position}
                                    disabled={frozen || saving}
                                    onChange={(next) => patch({ identity: { ...values.identity, position: next } })}
                                />
                                <Field
                                    id="qc-separation"
                                    label="Date of separation"
                                    value={values.identity.separation}
                                    disabled={frozen || saving}
                                    onChange={(next) => patch({ identity: { ...values.identity, separation: next } })}
                                />
                                <Field
                                    id="qc-company"
                                    label="Company"
                                    value={values.identity.company}
                                    disabled={frozen || saving}
                                    onChange={(next) => patch({ identity: { ...values.identity, company: next } })}
                                />
                                <Field
                                    id="qc-manager-date"
                                    label="Manager signature date"
                                    value={values.manager_signature_date}
                                    disabled={frozen || saving}
                                    onChange={(next) => patch({ manager_signature_date: next })}
                                />
                            </div>
                        </section>
                        <section className="space-y-4 rounded-md border p-4" aria-label="Section 2 accountabilities">
                            <h3 className="text-sm font-semibold">Section 2 — Accountabilities</h3>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Accountabilities
                                    </h4>
                                    {!frozen && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={saving}
                                            onClick={() => {
                                                setAccountabilityFilter("");
                                                setAccountabilityPage(1);
                                                patch({ accountabilities: [...values.accountabilities, blankAccountability()] });
                                            }}
                                        >
                                            <Plus className="h-4 w-4" aria-hidden="true" />
                                            Add row
                                        </Button>
                                    )}
                                </div>
                                <Input
                                    value={accountabilityFilter}
                                    disabled={frozen || saving}
                                    placeholder="Filter rows…"
                                    aria-label="Filter accountability rows"
                                    onChange={(event) => {
                                        setAccountabilityFilter(event.target.value);
                                        setAccountabilityPage(1);
                                    }}
                                />
                                <div className="overflow-x-auto rounded-md border">
                                    <table className="w-full min-w-[640px] text-sm">
                                        <thead>
                                            <tr className="border-b bg-muted/50 text-left text-xs">
                                                <th className="px-2 py-2 font-medium">Outlet</th>
                                                <th className="px-2 py-2 font-medium">Name</th>
                                                <th className="px-2 py-2 font-medium">Date</th>
                                                <th className="px-2 py-2 font-medium">Signature</th>
                                                <th className="px-2 py-2 font-medium">Remarks</th>
                                                {!frozen && <th className="w-10 px-2 py-2" />}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {accountabilityView.pageRows.map(({ entry, index }) => (
                                                <tr key={index} className="border-b last:border-0">
                                                    <td className="px-2 py-1">
                                                        <Input
                                                            value={entry.outlet}
                                                            disabled={frozen || saving}
                                                            aria-label={`Accountability ${index + 1} outlet`}
                                                            onChange={(event) => {
                                                                const next = [...values.accountabilities];
                                                                next[index] = { ...entry, outlet: event.target.value };
                                                                patch({ accountabilities: next });
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1">
                                                        <Input
                                                            value={entry.name}
                                                            disabled={frozen || saving}
                                                            aria-label={`Accountability ${index + 1} name`}
                                                            onChange={(event) => {
                                                                const next = [...values.accountabilities];
                                                                next[index] = { ...entry, name: event.target.value };
                                                                patch({ accountabilities: next });
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1">
                                                        <Input
                                                            value={entry.date}
                                                            disabled={frozen || saving}
                                                            aria-label={`Accountability ${index + 1} date`}
                                                            onChange={(event) => {
                                                                const next = [...values.accountabilities];
                                                                next[index] = { ...entry, date: event.target.value };
                                                                patch({ accountabilities: next });
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1">
                                                        <div className="h-9 rounded-sm border-b-2" title="Ruled cell — no ink capture" />
                                                    </td>
                                                    <td className="px-2 py-1">
                                                        <Input
                                                            value={entry.remarks}
                                                            disabled={frozen || saving}
                                                            aria-label={`Accountability ${index + 1} remarks`}
                                                            onChange={(event) => {
                                                                const next = [...values.accountabilities];
                                                                next[index] = { ...entry, remarks: event.target.value };
                                                                patch({ accountabilities: next });
                                                            }}
                                                        />
                                                    </td>
                                                    {!frozen && (
                                                        <td className="px-2 py-1">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                disabled={saving}
                                                                aria-label={`Remove accountability row ${index + 1}`}
                                                                onClick={() => patch({ accountabilities: values.accountabilities.filter((_, i) => i !== index) })}
                                                            >
                                                                <Minus className="h-4 w-4" aria-hidden="true" />
                                                            </Button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                            {values.accountabilities.length === 0 && (
                                                <tr>
                                                    <td colSpan={frozen ? 5 : 6} className="px-2 py-4 text-center text-xs text-muted-foreground">
                                                        No rows. Add a row to begin.
                                                    </td>
                                                </tr>
                                            )}
                                            {values.accountabilities.length > 0 && accountabilityRows.length === 0 && (
                                                <tr>
                                                    <td colSpan={frozen ? 5 : 6} className="px-2 py-4 text-center text-xs text-muted-foreground">
                                                        No rows match this filter.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <RowPager
                                    navLabel="Accountability rows pagination"
                                    page={accountabilityView.safePage}
                                    totalPages={accountabilityView.totalPages}
                                    start={accountabilityView.start}
                                    end={accountabilityView.end}
                                    total={accountabilityRows.length}
                                    onPageChange={setAccountabilityPage}
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Deductions
                                    </h4>
                                    {!frozen && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={saving}
                                            onClick={() => {
                                                setDeductionFilter("");
                                                setDeductionPage(1);
                                                patch({ deductions: [...values.deductions, blankDeduction()] });
                                            }}
                                        >
                                            <Plus className="h-4 w-4" aria-hidden="true" />
                                            Add row
                                        </Button>
                                    )}
                                </div>
                                <Input
                                    value={deductionFilter}
                                    disabled={frozen || saving}
                                    placeholder="Filter rows…"
                                    aria-label="Filter deduction rows"
                                    onChange={(event) => {
                                        setDeductionFilter(event.target.value);
                                        setDeductionPage(1);
                                    }}
                                />
                                <div className="overflow-x-auto rounded-md border">
                                    <table className="w-full min-w-[480px] text-sm">
                                        <thead>
                                            <tr className="border-b bg-muted/50 text-left text-xs">
                                                <th className="px-2 py-2 font-medium">{" "}</th>
                                                <th className="px-2 py-2 font-medium">Amount</th>
                                                <th className="px-2 py-2 font-medium">Certified by</th>
                                                {!frozen && <th className="w-10 px-2 py-2" />}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {deductionView.pageRows.map(({ entry, index }) => (
                                                <tr key={index} className="border-b last:border-0">
                                                    <td className="px-2 py-1">
                                                        <Input
                                                            value={entry.label}
                                                            disabled={frozen || saving}
                                                            aria-label={`Deduction ${index + 1} description`}
                                                            onChange={(event) => {
                                                                const next = [...values.deductions];
                                                                next[index] = { ...entry, label: event.target.value };
                                                                patch({ deductions: next });
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1">
                                                        <Input
                                                            value={entry.amount}
                                                            disabled={frozen || saving}
                                                            aria-label={`Deduction ${index + 1} amount`}
                                                            onChange={(event) => {
                                                                const next = [...values.deductions];
                                                                next[index] = { ...entry, amount: event.target.value };
                                                                patch({ deductions: next });
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1">
                                                        <div className="h-9 rounded-sm border-b-2" title="Ruled cell — no ink capture" />
                                                    </td>
                                                    {!frozen && (
                                                        <td className="px-2 py-1">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                disabled={saving}
                                                                aria-label={`Remove deduction row ${index + 1}`}
                                                                onClick={() => patch({ deductions: values.deductions.filter((_, i) => i !== index) })}
                                                            >
                                                                <Minus className="h-4 w-4" aria-hidden="true" />
                                                            </Button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                            {values.deductions.length === 0 && (
                                                <tr>
                                                    <td colSpan={frozen ? 3 : 4} className="px-2 py-4 text-center text-xs text-muted-foreground">
                                                        No rows. Add a row to begin.
                                                    </td>
                                                </tr>
                                            )}
                                            {values.deductions.length > 0 && deductionRows.length === 0 && (
                                                <tr>
                                                    <td colSpan={frozen ? 3 : 4} className="px-2 py-4 text-center text-xs text-muted-foreground">
                                                        No rows match this filter.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <RowPager
                                    navLabel="Deduction rows pagination"
                                    page={deductionView.safePage}
                                    totalPages={deductionView.totalPages}
                                    start={deductionView.start}
                                    end={deductionView.end}
                                    total={deductionRows.length}
                                    onPageChange={setDeductionPage}
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Due to employee
                                    </h4>
                                    {!frozen && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={saving}
                                            onClick={() => {
                                                setDueFilter("");
                                                setDuePage(1);
                                                patch({ due_to_employee: [...values.due_to_employee, blankDueToEmployee()] });
                                            }}
                                        >
                                            <Plus className="h-4 w-4" aria-hidden="true" />
                                            Add row
                                        </Button>
                                    )}
                                </div>
                                <Input
                                    value={dueFilter}
                                    disabled={frozen || saving}
                                    placeholder="Filter rows…"
                                    aria-label="Filter due to employee rows"
                                    onChange={(event) => {
                                        setDueFilter(event.target.value);
                                        setDuePage(1);
                                    }}
                                />
                                <div className="overflow-x-auto rounded-md border">
                                    <table className="w-full min-w-[480px] text-sm">
                                        <thead>
                                            <tr className="border-b bg-muted/50 text-left text-xs">
                                                <th className="px-2 py-2 font-medium">Item</th>
                                                <th className="px-2 py-2 font-medium">No. of days</th>
                                                <th className="px-2 py-2 font-medium">Amount</th>
                                                {!frozen && <th className="w-10 px-2 py-2" />}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dueView.pageRows.map(({ entry, index }) => (
                                                <tr key={index} className="border-b last:border-0">
                                                    <td className="px-2 py-1">
                                                        <Input
                                                            value={entry.item}
                                                            disabled={frozen || saving}
                                                            aria-label={`Due to employee ${index + 1} item`}
                                                            onChange={(event) => {
                                                                const next = [...values.due_to_employee];
                                                                next[index] = { ...entry, item: event.target.value };
                                                                patch({ due_to_employee: next });
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1">
                                                        <Input
                                                            value={entry.days}
                                                            disabled={frozen || saving}
                                                            aria-label={`Due to employee ${index + 1} days`}
                                                            onChange={(event) => {
                                                                const next = [...values.due_to_employee];
                                                                next[index] = { ...entry, days: event.target.value };
                                                                patch({ due_to_employee: next });
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1">
                                                        <Input
                                                            value={entry.amount}
                                                            disabled={frozen || saving}
                                                            aria-label={`Due to employee ${index + 1} amount`}
                                                            onChange={(event) => {
                                                                const next = [...values.due_to_employee];
                                                                next[index] = { ...entry, amount: event.target.value };
                                                                patch({ due_to_employee: next });
                                                            }}
                                                        />
                                                    </td>
                                                    {!frozen && (
                                                        <td className="px-2 py-1">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                disabled={saving}
                                                                aria-label={`Remove due to employee row ${index + 1}`}
                                                                onClick={() => patch({ due_to_employee: values.due_to_employee.filter((_, i) => i !== index) })}
                                                            >
                                                                <Minus className="h-4 w-4" aria-hidden="true" />
                                                            </Button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                            {values.due_to_employee.length === 0 && (
                                                <tr>
                                                    <td colSpan={frozen ? 3 : 4} className="px-2 py-4 text-center text-xs text-muted-foreground">
                                                        No rows. Add a row to begin.
                                                    </td>
                                                </tr>
                                            )}
                                            {values.due_to_employee.length > 0 && dueRows.length === 0 && (
                                                <tr>
                                                    <td colSpan={frozen ? 3 : 4} className="px-2 py-4 text-center text-xs text-muted-foreground">
                                                        No rows match this filter.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <RowPager
                                    navLabel="Due to employee rows pagination"
                                    page={dueView.safePage}
                                    totalPages={dueView.totalPages}
                                    start={dueView.start}
                                    end={dueView.end}
                                    total={dueRows.length}
                                    onPageChange={setDuePage}
                                />
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <Field
                                        id="qc-total"
                                        label="Total"
                                        value={values.totals.total}
                                        disabled={frozen || saving}
                                        onChange={(next) => patch({ totals: { ...values.totals, total: next } })}
                                    />
                                    <Field
                                        id="qc-less"
                                        label="Less: deductions"
                                        value={values.totals.less_deductions}
                                        disabled={frozen || saving}
                                        onChange={(next) => patch({ totals: { ...values.totals, less_deductions: next } })}
                                    />
                                    <Field
                                        id="qc-net"
                                        label="Net due to employee"
                                        value={values.totals.net}
                                        disabled={frozen || saving}
                                        onChange={(next) => patch({ totals: { ...values.totals, net: next } })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Section 2 signatories
                                </h4>
                                <div className="overflow-x-auto rounded-md border">
                                    <table className="w-full min-w-[320px] text-sm">
                                        <thead>
                                            <tr className="border-b bg-muted/50 text-left text-xs">
                                                <th className="px-2 py-2 font-medium">Role</th>
                                                <th className="px-2 py-2 font-medium">Name</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleSignatories.map((entry) => (
                                                <tr key={entry.label} className="border-b last:border-0">
                                                    <td className="px-2 py-2 text-xs font-medium">{entry.label}</td>
                                                    <td className="px-2 py-1">
                                                        <Input
                                                            value={entry.name}
                                                            disabled={frozen || saving}
                                                            aria-label={`${entry.label} name`}
                                                            onChange={(event) => {
                                                                const next = values.section2_signatories.map((signatory) =>
                                                                    signatory.label === entry.label
                                                                        ? { ...signatory, name: event.target.value }
                                                                        : signatory
                                                                );
                                                                patch({ section2_signatories: next });
                                                            }}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </section>
                        <section className="space-y-3 rounded-md border p-4" aria-label="Section 3 payment">
                            <h3 className="text-sm font-semibold">Section 3 — Release and quitclaim</h3>
                            <div className="grid gap-3 sm:grid-cols-3">
                                <Field
                                    id="qc-pay-amount"
                                    label="Amount"
                                    value={values.payment.amount}
                                    disabled={frozen || saving}
                                    onChange={(next) => patch({ payment: { ...values.payment, amount: next } })}
                                />
                                <Field
                                    id="qc-pay-check"
                                    label="Check / Account #"
                                    value={values.payment.check_no}
                                    disabled={frozen || saving}
                                    onChange={(next) => patch({ payment: { ...values.payment, check_no: next } })}
                                />
                                <Field
                                    id="qc-pay-date"
                                    label="Date"
                                    value={values.payment.date}
                                    disabled={frozen || saving}
                                    onChange={(next) => patch({ payment: { ...values.payment, date: next } })}
                                />
                            </div>
                            <Separator />
                            <div className="grid gap-3 sm:grid-cols-3">
                                <Field
                                    id="qc-rel-name"
                                    label="Released / Disbursed by"
                                    value={values.released_by.name}
                                    disabled={frozen || saving}
                                    onChange={(next) => patch({ released_by: { ...values.released_by, name: next } })}
                                />
                                <Field
                                    id="qc-rel-title"
                                    label="Title"
                                    value={values.released_by.title}
                                    disabled={frozen || saving}
                                    onChange={(next) => patch({ released_by: { ...values.released_by, title: next } })}
                                />
                                <Field
                                    id="qc-rel-date"
                                    label="Date signed"
                                    value={values.released_by.date}
                                    disabled={frozen || saving}
                                    onChange={(next) => patch({ released_by: { ...values.released_by, date: next } })}
                                />
                            </div>
                        </section>
                    </div>
                    <div className="lg:sticky lg:top-4">
                        <QuitClaimLivePreview values={values} company={company} />
                    </div>
                </div>
            )}
            <QuitClaimPrintDialog quitclaim={detail} initialCompany={company} open={printOpen} onOpenChange={setPrintOpen} />
        </div>
    );
}
