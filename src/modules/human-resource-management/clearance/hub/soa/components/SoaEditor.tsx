"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { ArrowDown, ArrowUp, Check, Eye, Loader2, Minus, Plus, Printer, Search, Upload } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { SoaSignatory } from "../types";
import type { SoaPrintInput, SoaPrintLine } from "../utils/soaPrintPdf";
import { buildSoaPdf } from "../utils/soaPrintPdf";
import { useSoaCompanies } from "../hooks/useSoaCompanies";
import { useSoaDetail, type SoaLinePayload } from "../hooks/useSoaDetail";
import { companyLogoDataUrl } from "../../utils/company";
import { SoaPrintDialog } from "./SoaPrintDialog";
import { Soa201Dialog } from "./Soa201Dialog";
import { LiveDocumentPreview } from "../../components/LiveDocumentPreview";

interface SoaEditorProps {
    requestId: number;
    autoPrint?: boolean;
}

interface DraftRow {
    key: string;
    description: string;
    amountText: string;
    remarks: string;
}

let draftKey = 0;

const LINES_PAGE_SIZE = 10;

function nextKey(): string {
    draftKey += 1;
    return `row-${draftKey}`;
}

function formatAmountText(value: number): string {
    return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function amountToText(amount: number | null): string {
    return amount === null ? "" : formatAmountText(amount);
}

function parseAmountValue(text: string): number | null {
    const cleaned = text.replace(/php\.?/gi, "").replace(/,/g, "").trim();
    if (cleaned === "") return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function isAmountValid(text: string): boolean {
    const cleaned = text.replace(/php\.?/gi, "").replace(/,/g, "").trim();
    if (cleaned === "") return true;
    return parseAmountValue(text) !== null;
}

function nonEmptySignatories(drafts: SoaSignatory[]): SoaSignatory[] {
    return drafts.filter(
        (draft) => draft.label.trim() !== "" || draft.name.trim() !== "" || draft.title.trim() !== ""
    );
}

function blankSignatoryDrafts(): SoaSignatory[] {
    return [
        { label: "Prepared By", name: "", title: "" },
        { label: "Noted By", name: "", title: "" },
        { label: "", name: "", title: "" },
    ];
}

function applySignatoryOverrides(model: SoaPrintInput, drafts: SoaSignatory[] | null): SoaPrintInput {
    if (drafts === null) return model;
    return { ...model, signatories: nonEmptySignatories(drafts) };
}

function describeSoa201(model: SoaPrintInput | null, refNo: string | null): string {
    const name = model === null ? "" : model.employeeName.trim();
    const ref = refNo === null || refNo === "" ? "" : `REF ${refNo}`;
    if (name === "" && ref === "") return "Statement of account";
    if (name === "") return ref;
    if (ref === "") return name;
    return `${name} — ${ref}`;
}

function toFileName(employeeName: string, refNo: string): string {
    const cleaned = employeeName
        .split("")
        .filter((ch) => ch >= " " && !"<>:\"/\\|?*".includes(ch))
        .join("")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
    const who = cleaned === "" ? "Employee" : cleaned;
    const ref = refNo.trim() === "" ? "pending" : refNo.trim();
    return `SOA - ${who} - ${ref}.pdf`;
}

export function SoaEditor({ requestId, autoPrint = false }: SoaEditorProps): JSX.Element {
    const { detail, items, templateId, formClearanceNo, loading, error, reload, saveLines, approve, fetchRenderModel } =
        useSoaDetail(requestId);
    const companies = useSoaCompanies(requestId);
    const [drafts, setDrafts] = useState<Record<number, DraftRow[]>>({});
    const [seededFor, setSeededFor] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const [approving, setApproving] = useState(false);
    const [model, setModel] = useState<SoaPrintInput | null>(null);
    const [printOpen, setPrintOpen] = useState(false);
    const [signatoryDrafts, setSignatoryDrafts] = useState<SoaSignatory[]>(() => blankSignatoryDrafts());
    const [signatoriesReady, setSignatoriesReady] = useState(false);
    const [signatoriesError, setSignatoriesError] = useState(false);
    const [signatoryRetry, setSignatoryRetry] = useState(0);
    const [signatorySeededFor, setSignatorySeededFor] = useState<string | null>(null);
    const [savedDrafts, setSavedDrafts] = useState<Record<number, DraftRow[]> | null>(null);
    const [savedSignatories, setSavedSignatories] = useState<SoaSignatory[] | null>(null);
    const [lineQuery, setLineQuery] = useState("");
    const [linePages, setLinePages] = useState<Record<number, number>>({});
    const [soa201Open, setSoa201Open] = useState(false);
    const autoPrintFiredRef = useRef<number | null>(null);
    const liveModelKeyRef = useRef<string | null>(null);

    const sections = useMemo(() => {
        if (detail !== null && detail.groups.length > 0) {
            return detail.groups.map((group) => ({
                key: group.id,
                label: group.label,
                itemId: null as number | null,
                templateRowId: group.id as number | null,
            }));
        }
        return items.map((item) => ({
            key: item.id,
            label: item.label_snapshot,
            itemId: item.id as number | null,
            templateRowId: null as number | null,
        }));
    }, [detail, items]);

    useEffect(() => {
        if (!detail || detail.id === seededFor) return;
        const useTemplate = detail.groups.length > 0;
        const seeded: Record<number, DraftRow[]> = {};
        for (const section of sections) {
            const stored = detail.lines
                .filter((line) => useTemplate
                    ? line.soa_template_row_id === section.key
                    : line.item_id === section.key)
                .sort((left, right) => left.sort_order - right.sort_order || left.id - right.id);
            seeded[section.key] = stored.length > 0
                ? stored.map((line) => ({
                    key: nextKey(),
                    description: line.description ?? "",
                    amountText: amountToText(line.amount),
                    remarks: line.remarks ?? "",
                }))
                : [{ key: nextKey(), description: "", amountText: "", remarks: "" }];
        }
        setDrafts(seeded);
        setSavedDrafts(seeded);
        setSeededFor(detail.id);
    }, [detail, sections, seededFor]);

    useEffect(() => {
        if (!detail) return;
        const key = `${detail.id}:${templateId ?? 0}`;
        if (signatorySeededFor === key) return;
        if (detail.signatories !== null) {
            const seeded = blankSignatoryDrafts();
            detail.signatories.slice(0, 3).forEach((row, index) => {
                seeded[index] = { label: row.label, name: row.name, title: row.title };
            });
            setSignatoryDrafts(seeded);
            setSavedSignatories(seeded.map((row) => ({ ...row })));
            setSignatoriesReady(true);
            setSignatoriesError(false);
            setSignatorySeededFor(key);
            return;
        }
        if (templateId === null) {
            setSignatoryDrafts(blankSignatoryDrafts());
            setSavedSignatories(null);
            setSignatoriesReady(false);
            setSignatoriesError(false);
            return;
        }
        let cancelled = false;
        setSignatoriesError(false);
        (async () => {
            try {
                const res = await fetch(`/api/hrm/clearance/soa/signatories?template_id=${templateId}`);
                const json: unknown = await res.json().catch(() => null);
                if (cancelled) return;
                if (!res.ok) {
                    setSignatoriesReady(false);
                    setSignatoriesError(true);
                    return;
                }
                if (
                    json !== null &&
                    typeof json === "object" &&
                    "success" in json &&
                    (json as { success: unknown }).success === true &&
                    "data" in json &&
                    Array.isArray((json as { data: unknown }).data)
                ) {
                    const rows = ((json as { data: unknown[] }).data).filter(
                        (entry): entry is SoaSignatory =>
                            entry !== null &&
                            typeof entry === "object" &&
                            "label" in entry &&
                            "name" in entry &&
                            "title" in entry
                    );
                    const seeded = blankSignatoryDrafts();
                    rows.slice(0, 3).forEach((row, index) => {
                        seeded[index] = { label: row.label, name: row.name, title: row.title };
                    });
                    setSignatoryDrafts(seeded);
                    setSavedSignatories(seeded.map((row) => ({ ...row })));
                    setSignatoriesReady(true);
                    setSignatoriesError(false);
                    setSignatorySeededFor(key);
                } else {
                    setSignatoriesReady(false);
                    setSignatoriesError(true);
                }
            } catch {
                if (!cancelled) {
                    setSignatoriesReady(false);
                    setSignatoriesError(true);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [detail, templateId, signatorySeededFor, signatoryRetry]);

    const typedSignatoryCount = useMemo(
        () => nonEmptySignatories(signatoryDrafts).length,
        [signatoryDrafts]
    );

    const signatoryOverlay = signatoriesReady || typedSignatoryCount > 0 ? signatoryDrafts : null;

    const previewLines = useMemo<SoaPrintLine[]>(() => {
        const lines: SoaPrintLine[] = [];
        for (const section of sections) {
            for (const row of drafts[section.key] ?? []) {
                lines.push({
                    department: section.label,
                    description: row.description.trim(),
                    amount: parseAmountValue(row.amountText),
                    remarks: row.remarks.trim(),
                });
            }
        }
        return lines;
    }, [sections, drafts]);

    const previewModel = useMemo<SoaPrintInput | null>(() => {
        if (model === null) return null;
        return applySignatoryOverrides(
            {
                ...model,
                lines: previewLines,
                companyContact: companies.selected?.company_contact ?? null,
                companyEmail: companies.selected?.company_email ?? null,
            },
            signatoryOverlay
        );
    }, [model, previewLines, signatoryOverlay, companies.selected]);

    const buildPreviewPdf = useCallback((): Uint8Array => {
        if (previewModel === null) return new Uint8Array();
        return buildSoaPdf(previewModel);
    }, [previewModel]);

    const previewRevision = useMemo(() => JSON.stringify(previewModel ?? null), [previewModel]);

    useEffect(() => {
        if (!autoPrint || detail === null || companies.loading || companies.employeeCompanyLoading) return;
        if (autoPrintFiredRef.current === requestId) return;
        const selected = companies.selected;
        if (selected === null) {
            autoPrintFiredRef.current = requestId;
            return;
        }
        if (companies.employeeCompany !== null && selected.id !== companies.employeeCompany.id) return;
        autoPrintFiredRef.current = requestId;
        const snapshot = {
            company_name: selected.company_name,
            company_address: selected.company_address ?? "",
            logo_data_url: companies.logoDataUrl,
        };
        setPreviewing(true);
        (async () => {
            try {
                const renderModel = await fetchRenderModel(requestId, snapshot);
                const withClearance = renderModel.clearanceNo === "" && formClearanceNo !== ""
                    ? { ...renderModel, clearanceNo: formClearanceNo }
                    : renderModel;
                setModel(applySignatoryOverrides(withClearance, signatoryOverlay));
                setPrintOpen(true);
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not build the SOA preview.");
            } finally {
                setPreviewing(false);
            }
        })();
    }, [autoPrint, detail, companies.loading, companies.employeeCompanyLoading, companies.employeeCompany, companies.selected, companies.logoDataUrl, fetchRenderModel, requestId, signatoryOverlay, formClearanceNo]);

    useEffect(() => {
        if (autoPrint || detail === null || model !== null) return;
        if (companies.loading || companies.employeeCompanyLoading || previewing || printOpen) return;
        const selected = companies.selected;
        const snapshot: { company_name: string; company_address: string; logo_data_url: string | null } = selected === null
            ? { company_name: "", company_address: "", logo_data_url: null }
            : {
                company_name: selected.company_name,
                company_address: selected.company_address ?? "",
                logo_data_url: companies.logoDataUrl,
            };
        const key = `${requestId}:${selected === null ? "no-company" : selected.id}`;
        if (liveModelKeyRef.current === key) return;
        liveModelKeyRef.current = key;
        let cancelled = false;
        let settled = false;
        (async () => {
            try {
                const renderModel = await fetchRenderModel(requestId, snapshot);
                if (cancelled) return;
                const withClearance = renderModel.clearanceNo === "" && formClearanceNo !== ""
                    ? { ...renderModel, clearanceNo: formClearanceNo }
                    : renderModel;
                settled = true;
                setModel(withClearance);
            } catch {
                if (cancelled) return;
                liveModelKeyRef.current = null;
            }
        })();
        return () => {
            cancelled = true;
            if (!settled && liveModelKeyRef.current === key) {
                liveModelKeyRef.current = null;
            }
        };
    }, [autoPrint, detail, model, companies.loading, companies.employeeCompanyLoading, companies.selected, companies.logoDataUrl, previewing, printOpen, fetchRenderModel, requestId, formClearanceNo]);

    const invalidCount = useMemo(() => {
        let count = 0;
        for (const rows of Object.values(drafts)) {
            for (const row of rows) {
                if (!isAmountValid(row.amountText)) count += 1;
            }
        }
        return count;
    }, [drafts]);

    const dirtyCount = useMemo(() => {
        if (savedDrafts === null) return 0;
        let count = 0;
        const keys = new Set<number>([
            ...Object.keys(drafts).map(Number),
            ...Object.keys(savedDrafts).map(Number),
        ]);
        for (const key of keys) {
            const current = drafts[key] ?? [];
            const baseline = savedDrafts[key] ?? [];
            const length = Math.max(current.length, baseline.length);
            for (let index = 0; index < length; index += 1) {
                const row = current[index];
                const saved = baseline[index];
                if (
                    row === undefined ||
                    saved === undefined ||
                    row.description !== saved.description ||
                    row.amountText.trim() !== saved.amountText.trim() ||
                    row.remarks !== saved.remarks
                ) {
                    count += 1;
                }
            }
        }
        const baselineSignatories = savedSignatories ?? blankSignatoryDrafts();
        signatoryDrafts.forEach((draft, index) => {
            const saved = baselineSignatories[index] ?? { label: "", name: "", title: "" };
            if (draft.name !== saved.name || draft.title !== saved.title) count += 1;
        });
        return count;
    }, [drafts, savedDrafts, signatoryDrafts, savedSignatories]);

    const isDirty = savedDrafts !== null && dirtyCount > 0;

    const isApproved = detail?.status === "approved";

    const hasUpload = (detail?.pdf_file ?? "") !== "";
    const approveBlockedReason = hasUpload
        ? null
        : "Upload the signed copy to the 201 file before approving.";
    const soa201Description = describeSoa201(model, detail?.ref_no ?? null);

    async function handleApprove(): Promise<void> {
        if (!detail || isApproved || approving) return;
        if (!hasUpload) {
            toast.error(approveBlockedReason ?? "Upload the signed copy to the 201 file before approving.");
            return;
        }
        const companyCode = companies.selected?.company_code ?? detail.company_code ?? "";
        if (companyCode === "") {
            toast.error("Set the employee company before approving.");
            return;
        }
        setApproving(true);
        try {
            await approve(requestId, companyCode);
            toast.success("Statement of account approved.");
            reload();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not approve the statement of account.");
        } finally {
            setApproving(false);
        }
    }

    function updateRow(sectionKey: number, key: string, patch: Partial<DraftRow>): void {
        setDrafts((prev) => ({
            ...prev,
            [sectionKey]: (prev[sectionKey] ?? []).map((row) => (row.key === key ? { ...row, ...patch } : row)),
        }));
    }

    function addRow(sectionKey: number): void {
        setDrafts((prev) => ({
            ...prev,
            [sectionKey]: [...(prev[sectionKey] ?? []), { key: nextKey(), description: "", amountText: "", remarks: "" }],
        }));
    }

    function removeRow(sectionKey: number, key: string): void {
        setDrafts((prev) => ({
            ...prev,
            [sectionKey]: (prev[sectionKey] ?? []).filter((row) => row.key !== key),
        }));
    }

    function moveRow(sectionKey: number, key: string, direction: -1 | 1): void {
        setDrafts((prev) => {
            const rows = prev[sectionKey] ?? [];
            const index = rows.findIndex((row) => row.key === key);
            const target = index + direction;
            if (index < 0 || target < 0 || target >= rows.length) return prev;
            const next = [...rows];
            const [moved] = next.splice(index, 1);
            if (moved === undefined) return prev;
            next.splice(target, 0, moved);
            return { ...prev, [sectionKey]: next };
        });
    }

    function updateSignatory(index: number, field: "name" | "title", value: string): void {
        setSignatoryDrafts((prev) =>
            prev.map((draft, draftIndex) => (draftIndex === index ? { ...draft, [field]: value } : draft))
        );
    }

    function buildPayload(): SoaLinePayload[] {
        const payload: SoaLinePayload[] = [];
        let order = 0;
        for (const section of sections) {
            for (const row of drafts[section.key] ?? []) {
                payload.push({
                    item_id: section.itemId,
                    soa_template_row_id: section.templateRowId,
                    description: row.description.trim(),
                    amount: parseAmountValue(row.amountText),
                    remarks: row.remarks.trim(),
                    sort_order: order,
                });
                order += 1;
            }
        }
        return payload;
    }

    async function handleSave(): Promise<void> {
        if (!detail || isApproved) return;
        if (invalidCount > 0) {
            toast.error("Fix the highlighted amounts before saving. Amounts must be zero or more.");
            return;
        }
        if (!isDirty) return;
        setSaving(true);
        try {
            const typed = nonEmptySignatories(signatoryDrafts);
            const signatories = signatoriesReady || typed.length > 0 ? typed : undefined;
            const payload = buildPayload();
            const savedRows = await saveLines(detail.id, payload, signatories);
            if (!signatoriesReady && typed.length > 0) {
                toast.success("SOA lines saved with the typed signatures.");
            } else {
                toast.success("SOA lines saved.");
            }
            const useTemplate = detail.groups.length > 0;
            if (savedRows.length > 0 || payload.length === 0) {
                const rebuilt: Record<number, DraftRow[]> = {};
                for (const section of sections) {
                    const stored = savedRows
                        .filter((line) => useTemplate
                            ? line.soa_template_row_id === section.key
                            : line.item_id === section.key)
                        .sort((left, right) => left.sort_order - right.sort_order || left.id - right.id);
                    rebuilt[section.key] = stored.length > 0
                        ? stored.map((line) => ({
                            key: nextKey(),
                            description: line.description ?? "",
                            amountText: amountToText(line.amount),
                            remarks: line.remarks ?? "",
                        }))
                        : [{ key: nextKey(), description: "", amountText: "", remarks: "" }];
                }
                setDrafts(rebuilt);
                setSavedDrafts(rebuilt);
            } else {
                const snapshot: Record<number, DraftRow[]> = {};
                for (const key of Object.keys(drafts)) {
                    const numeric = Number(key);
                    snapshot[numeric] = (drafts[numeric] ?? []).map((row) => ({ ...row }));
                }
                setSavedDrafts(snapshot);
            }
            setSavedSignatories(signatoryDrafts.map((row) => ({ ...row })));
            await reload();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not save the SOA lines.");
        } finally {
            setSaving(false);
        }
    }

    function companySnapshot(): { company_name: string; company_address: string; logo_data_url: string | null } | null {
        if (!companies.selected) return null;
        return {
            company_name: companies.selected.company_name,
            company_address: companies.selected.company_address ?? "",
            logo_data_url: companies.logoDataUrl,
        };
    }

    async function handlePreview(): Promise<void> {
        if (companies.employeeCompanyLoading) {
            toast.error("Resolving the employee company. Please try again.");
            return;
        }
        const snapshot = companySnapshot();
        if (!snapshot) {
            toast.error("Could not resolve the company for the letterhead.");
            return;
        }
        setPreviewing(true);
        try {
            const renderModel = await fetchRenderModel(requestId, snapshot);
            const withClearance = renderModel.clearanceNo === "" && formClearanceNo !== ""
                ? { ...renderModel, clearanceNo: formClearanceNo }
                : renderModel;
            setModel(applySignatoryOverrides(withClearance, signatoryOverlay));
            setPrintOpen(true);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not build the SOA preview.");
        } finally {
            setPreviewing(false);
        }
    }

    async function handleCompanySaved(companyId: number): Promise<void> {
        await companies.refreshEmployeeCompany();
        reload();
        const option = companies.options.find((entry) => entry.id === companyId) ?? null;
        if (!option) return;
        try {
            const renderModel = await fetchRenderModel(requestId, {
                company_name: option.company_name,
                company_address: option.company_address ?? "",
                logo_data_url: companyLogoDataUrl(option),
            });
            const withClearance = renderModel.clearanceNo === "" && formClearanceNo !== ""
                ? { ...renderModel, clearanceNo: formClearanceNo }
                : renderModel;
            setModel(applySignatoryOverrides(withClearance, signatoryOverlay));
        } catch {
            return;
        }
    }

    if (loading || (detail === null && error === null)) {
        return (
            <div className="space-y-2">
                {[...Array(6)].map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full" />
                ))}
            </div>
        );
    }

    if (error || !detail) {
        return (
            <div className="space-y-3">
                <Alert variant="destructive">
                    <AlertDescription>{error ?? "Statement of account not found."}</AlertDescription>
                </Alert>
                <Button variant="outline" size="sm" onClick={reload}>
                    Retry
                </Button>
            </div>
        );
    }

    const resolvedClearanceNo = detail.clearance_no !== null && detail.clearance_no !== ""
        ? detail.clearance_no
        : (formClearanceNo === "" ? null : formClearanceNo);

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Statement of Accounts</h2>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                    {detail.ref_no && <Badge variant="outline">REF {detail.ref_no}</Badge>}
                    {resolvedClearanceNo && <Badge variant="outline">Clearance {resolvedClearanceNo}</Badge>}
                    </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                        className="min-h-11 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 md:min-h-0"
                        onClick={() => void handleSave()}
                        disabled={saving || invalidCount > 0 || !isDirty || isApproved}
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        {saving ? "Saving…" : "Save lines"}
                    </Button>
                    <Button
                        variant="outline"
                        className="min-h-11 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 md:min-h-0"
                        onClick={() => void handlePreview()}
                        disabled={previewing}
                    >
                        {previewing
                            ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            : <Printer className="h-4 w-4" aria-hidden="true" />}
                        {previewing ? "Building…" : "Print"}
                    </Button>
                    <Button
                        type="button"
                        variant={hasUpload ? "outline" : "default"}
                        onClick={() => setSoa201Open(true)}
                        disabled={isApproved && !hasUpload}
                        aria-label={hasUpload ? "View the filed signed copy" : "Upload to the 201 file"}
                        title={hasUpload ? "View the filed signed copy" : "Upload to the 201 file"}
                    >
                        {hasUpload ? (
                            <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                        ) : (
                            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                        )}
                        {hasUpload ? "View" : "Upload to 201"}
                    </Button>
                    {!isApproved && (
                        <span title={approveBlockedReason ?? undefined}>
                            <Button
                                className="min-h-11 w-full bg-success text-success-foreground hover:bg-success/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 sm:w-auto md:min-h-0"
                                onClick={() => void handleApprove()}
                                disabled={!hasUpload || approving}
                            >
                                {approving
                                    ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                    : <Check className="h-4 w-4" aria-hidden="true" />}
                                {approving ? "Approving…" : "Approve"}
                            </Button>
                        </span>
                    )}
                </div>
            </div>
            {!isApproved && !hasUpload && (
                <p className="text-xs text-muted-foreground">
                    Upload the scanned signed copy to the 201 file to enable approval.
                </p>
            )}
            {!isApproved && hasUpload && (
                <p className="text-xs text-muted-foreground">
                    Signed copy filed to the 201 file. Replacing it overwrites the filed copy.
                </p>
            )}

            <div className="grid gap-6 lg:grid-cols-[520px_minmax(0,1fr)] xl:grid-cols-[560px_minmax(0,1fr)] items-start">
                <div className="min-w-0 space-y-4">
                    {sections.length === 0 && (
                        <Alert>
                            <AlertDescription>
                                This request has no statement-of-account rows, so there is nothing to enter lines for.
                            </AlertDescription>
                        </Alert>
                    )}

                    {sections.length > 0 && (
                        <div className="relative">
                            <Search
                                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <Input
                                id="soa-line-filter"
                                value={lineQuery}
                                disabled={isApproved}
                                onChange={(event) => {
                                    setLineQuery(event.target.value);
                                    setLinePages({});
                                }}
                                placeholder="Filter lines by description or remarks…"
                                aria-label="Filter SOA lines by description or remarks"
                                className="pl-9"
                            />
                        </div>
                    )}

                    {sections.map((section) => {
                        const allRows = drafts[section.key] ?? [];
                        const query = lineQuery.trim().toLowerCase();
                        const matched = query === ""
                            ? allRows
                            : allRows.filter(
                                (row) =>
                                    row.description.toLowerCase().includes(query) ||
                                    row.remarks.toLowerCase().includes(query)
                            );
                        const total = matched.length;
                        const pageCount = Math.max(1, Math.ceil(total / LINES_PAGE_SIZE));
                        const page = Math.min(linePages[section.key] ?? 0, pageCount - 1);
                        const rangeStart = total === 0 ? 0 : page * LINES_PAGE_SIZE + 1;
                        const rangeEnd = Math.min(total, page * LINES_PAGE_SIZE + LINES_PAGE_SIZE);
                        const visible = matched.slice(page * LINES_PAGE_SIZE, page * LINES_PAGE_SIZE + LINES_PAGE_SIZE);
                        return (
                        <Card key={section.key}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-sm">{section.label}</CardTitle>
                                {!isApproved && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="min-h-11 md:min-h-0"
                                        onClick={() => addRow(section.key)}
                                    >
                                        <Plus className="h-4 w-4" aria-hidden="true" />
                                        Add line
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {visible.map((row) => {
                                    const invalid = !isAmountValid(row.amountText);
                                    const position = allRows.findIndex((entry) => entry.key === row.key);
                                    const descriptionId = `soa-${section.key}-${row.key}-description`;
                                    const amountId = `soa-${section.key}-${row.key}-amount`;
                                    const remarksId = `soa-${section.key}-${row.key}-remarks`;
                                    return (
                                        <div
                                            key={row.key}
                                            className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_160px_1fr_auto]"
                                        >
                                            <div className="grid gap-1.5">
                                                <Label htmlFor={descriptionId}>Description</Label>
                                                <Input
                                                    id={descriptionId}
                                                    value={row.description}
                                                    disabled={isApproved}
                                                    placeholder="Description"
                                                    onChange={(event) =>
                                                        updateRow(section.key, row.key, { description: event.target.value })
                                                    }
                                                />
                                            </div>
                                            <div className="grid gap-1.5">
                                                <Label htmlFor={amountId}>Amount</Label>
                                                <Input
                                                    id={amountId}
                                                    value={row.amountText}
                                                    disabled={isApproved}
                                                    inputMode="decimal"
                                                    placeholder="0.00"
                                                    aria-invalid={invalid}
                                                    className={invalid ? "border-destructive" : undefined}
                                                    onChange={(event) =>
                                                        updateRow(section.key, row.key, { amountText: event.target.value })
                                                    }
                                                    onBlur={() => {
                                                        const parsed = parseAmountValue(row.amountText);
                                                        if (parsed !== null) {
                                                            updateRow(section.key, row.key, {
                                                                amountText: formatAmountText(parsed),
                                                            });
                                                        }
                                                    }}
                                                />
                                                {invalid && (
                                                    <p className="text-xs text-destructive">
                                                        Enter a valid amount of zero or more.
                                                    </p>
                                                )}
                                            </div>
                                            <div className="grid gap-1.5">
                                                <Label htmlFor={remarksId}>Remarks</Label>
                                                <Input
                                                    id={remarksId}
                                                    value={row.remarks}
                                                    disabled={isApproved}
                                                    placeholder="Remarks"
                                                    onChange={(event) =>
                                                        updateRow(section.key, row.key, { remarks: event.target.value })
                                                    }
                                                />
                                            </div>
                                            {!isApproved && (
                                                <div className="flex items-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`Move line up in ${section.label}`}
                                                        disabled={query !== "" || position <= 0}
                                                        onClick={() => moveRow(section.key, row.key, -1)}
                                                    >
                                                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`Move line down in ${section.label}`}
                                                        disabled={query !== "" || position < 0 || position >= allRows.length - 1}
                                                        onClick={() => moveRow(section.key, row.key, 1)}
                                                    >
                                                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label="Remove line"
                                                        onClick={() => removeRow(section.key, row.key)}
                                                    >
                                                        <Minus className="h-4 w-4" aria-hidden="true" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {allRows.length === 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        No lines for this category. Saved lines replace everything already stored.
                                    </p>
                                )}
                                {allRows.length > 0 && total === 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        No lines match the filter.
                                    </p>
                                )}
                                {query !== "" && total > 0 && (
                                    <p className="text-xs text-muted-foreground" aria-live="polite">
                                        {total} of {allRows.length} lines match the filter.
                                    </p>
                                )}
                                {total > LINES_PAGE_SIZE && (
                                    <nav
                                        aria-label={`Pagination for ${section.label} lines`}
                                        className="flex flex-wrap items-center justify-between gap-2"
                                    >
                                        <p className="text-xs text-muted-foreground" aria-live="polite">
                                            Showing {rangeStart}–{rangeEnd} of {total}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={page <= 0}
                                                aria-label={`Previous page of ${section.label} lines`}
                                                onClick={() =>
                                                    setLinePages((prev) => ({ ...prev, [section.key]: page - 1 }))
                                                }
                                            >
                                                Previous
                                            </Button>
                                            <span className="text-xs text-muted-foreground" aria-live="polite">
                                                Page {page + 1} of {pageCount}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={page >= pageCount - 1}
                                                aria-label={`Next page of ${section.label} lines`}
                                                onClick={() =>
                                                    setLinePages((prev) => ({ ...prev, [section.key]: page + 1 }))
                                                }
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </nav>
                                )}
                            </CardContent>
                        </Card>
                        );
                    })}

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Signatories</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {signatoriesError && !isApproved && (
                                <Alert variant="destructive">
                                    <AlertTitle>Could not load the template signatures.</AlertTitle>
                                    <AlertDescription className="flex flex-wrap items-center gap-2">
                                        <span>Any names and titles typed below will still be saved.</span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setSignatoriesError(false);
                                                setSignatoryRetry((count) => count + 1);
                                            }}
                                        >
                                            Retry
                                        </Button>
                                    </AlertDescription>
                                </Alert>
                            )}
                            <div className="grid gap-2">
                            {signatoryDrafts.map((draft, index) => {
                                const blockLabel = draft.label === "" ? "Additional Signatory" : draft.label;
                                const nameId = `soa-signatory-${index}-name`;
                                const titleId = `soa-signatory-${index}-title`;
                                return (
                                <div key={`signatory-${index}`} className="grid gap-2 rounded-md border p-3">
                                    <p className="text-sm font-medium">
                                        {blockLabel}
                                    </p>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor={nameId}>Name</Label>
                                        <Input
                                            id={nameId}
                                            aria-label={`${blockLabel} name`}
                                            value={draft.name}
                                            disabled={isApproved}
                                            placeholder="Name"
                                            onChange={(event) => updateSignatory(index, "name", event.target.value)}
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor={titleId}>Title</Label>
                                        <Input
                                            id={titleId}
                                            aria-label={`${blockLabel} title`}
                                            value={draft.title}
                                            disabled={isApproved}
                                            placeholder="Title"
                                            onChange={(event) => updateSignatory(index, "title", event.target.value)}
                                        />
                                    </div>
                                </div>
                                );
                            })}
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:sticky lg:top-4">
                    <LiveDocumentPreview
                        build={buildPreviewPdf}
                        revision={previewRevision}
                        title="Statement of account live preview"
                        loadingLabel="Generating PDF preview…"
                        unavailable={model === null}
                        unavailableLabel="Loading statement of account…"
                        caption="Live preview updates as fields change."
                    />
                </div>
            </div>

            <Soa201Dialog
                open={soa201Open}
                onOpenChange={setSoa201Open}
                documentId={detail.id}
                pdfFile={detail.pdf_file}
                description={soa201Description}
                readOnly={isApproved}
                onUploaded={() => {
                    void reload();
                }}
            />

            <SoaPrintDialog
                model={model}
                fileName={model ? toFileName(model.employeeName, model.refNo) : ""}
                open={printOpen}
                onOpenChange={setPrintOpen}
                requestId={requestId}
                companyOptions={companies.options}
                companiesLoading={companies.loading}
                employeeCompany={companies.employeeCompany}
                employeeCompanyLoading={companies.employeeCompanyLoading}
                onCompanySaved={(companyId) => void handleCompanySaved(companyId)}
                isApproved={isApproved}
            />
        </div>
    );
}
