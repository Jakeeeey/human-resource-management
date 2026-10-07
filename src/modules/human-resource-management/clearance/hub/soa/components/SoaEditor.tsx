"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { Loader2, Minus, Plus, Printer } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { SoaSignatory } from "../types";
import type { SoaPrintInput } from "../utils/soaPrintPdf";
import { useSoaCompanies } from "../hooks/useSoaCompanies";
import { useSoaDetail, type SoaLinePayload } from "../hooks/useSoaDetail";
import { SoaPrintDialog } from "./SoaPrintDialog";

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

function nextKey(): string {
    draftKey += 1;
    return `row-${draftKey}`;
}

function amountToText(amount: number | null): string {
    return amount === null ? "" : String(amount);
}

function isAmountValid(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed === "") return true;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed >= 0;
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
    const overridden = drafts.filter(
        (draft) => draft.label.trim() !== "" || draft.name.trim() !== "" || draft.title.trim() !== ""
    );
    return { ...model, signatories: overridden };
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
    const { detail, items, templateId, loading, error, reload, saveLines, fetchRenderModel } =
        useSoaDetail(requestId);
    const companies = useSoaCompanies(requestId);
    const [drafts, setDrafts] = useState<Record<number, DraftRow[]>>({});
    const [seededFor, setSeededFor] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const [model, setModel] = useState<SoaPrintInput | null>(null);
    const [printOpen, setPrintOpen] = useState(false);
    const [signatoryDrafts, setSignatoryDrafts] = useState<SoaSignatory[]>(() => blankSignatoryDrafts());
    const [signatoriesReady, setSignatoriesReady] = useState(false);
    const [signatorySeededFor, setSignatorySeededFor] = useState<string | null>(null);
    const autoPrintFiredRef = useRef<number | null>(null);

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
            setSignatoriesReady(true);
            setSignatorySeededFor(key);
            return;
        }
        if (templateId === null) {
            setSignatoryDrafts(blankSignatoryDrafts());
            setSignatoriesReady(false);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/hrm/clearance/soa/signatories?template_id=${templateId}`);
                const json: unknown = await res.json().catch(() => null);
                if (cancelled) return;
                if (!res.ok) {
                    setSignatoryDrafts(blankSignatoryDrafts());
                    setSignatoriesReady(false);
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
                    setSignatoriesReady(true);
                    setSignatorySeededFor(key);
                } else {
                    setSignatoryDrafts(blankSignatoryDrafts());
                    setSignatoriesReady(false);
                }
            } catch {
                if (!cancelled) {
                    setSignatoryDrafts(blankSignatoryDrafts());
                    setSignatoriesReady(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [detail, templateId, signatorySeededFor]);

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
                setModel(applySignatoryOverrides(renderModel, signatoriesReady ? signatoryDrafts : null));
                setPrintOpen(true);
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not build the SOA preview.");
            } finally {
                setPreviewing(false);
            }
        })();
    }, [autoPrint, detail, companies.loading, companies.employeeCompanyLoading, companies.employeeCompany, companies.selected, companies.logoDataUrl, fetchRenderModel, requestId, signatoriesReady, signatoryDrafts]);

    const invalidCount = useMemo(() => {
        let count = 0;
        for (const rows of Object.values(drafts)) {
            for (const row of rows) {
                if (!isAmountValid(row.amountText)) count += 1;
            }
        }
        return count;
    }, [drafts]);

    const isApproved = detail?.status === "approved";

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
                const amountText = row.amountText.trim();
                payload.push({
                    item_id: section.itemId,
                    soa_template_row_id: section.templateRowId,
                    description: row.description.trim(),
                    amount: amountText === "" ? null : Number(amountText),
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
        setSaving(true);
        try {
            const signatories = signatoriesReady
                ? signatoryDrafts.filter(
                    (draft) => draft.label.trim() !== "" || draft.name.trim() !== "" || draft.title.trim() !== ""
                )
                : undefined;
            await saveLines(detail.id, buildPayload(), signatories);
            toast.success("SOA lines saved.");
            setSeededFor(null);
            reload();
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
            toast.error("Pick a company for the letterhead first.");
            return;
        }
        setPreviewing(true);
        try {
            const renderModel = await fetchRenderModel(requestId, snapshot);
            setModel(applySignatoryOverrides(renderModel, signatoriesReady ? signatoryDrafts : null));
            setPrintOpen(true);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not build the SOA preview.");
        } finally {
            setPreviewing(false);
        }
    }

    if (loading) {
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

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">Request #{detail.request_id}</span>
                    <Badge variant={isApproved ? "default" : "secondary"}>{detail.status}</Badge>
                    {detail.ref_no && <Badge variant="outline">REF {detail.ref_no}</Badge>}
                    {detail.clearance_no && <Badge variant="outline">Clearance {detail.clearance_no}</Badge>}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    {!isApproved && (
                        <Button onClick={() => void handleSave()} disabled={saving || invalidCount > 0}>
                            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                            {saving ? "Saving…" : "Save lines"}
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        onClick={() => void handlePreview()}
                        disabled={previewing}
                    >
                        {previewing
                            ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            : <Printer className="h-4 w-4" aria-hidden="true" />}
                        {previewing ? "Building…" : "Preview / Print"}
                    </Button>
                </div>
            </div>

            {companies.employeeCompany === null && (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Letterhead</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="grid w-full max-w-sm gap-1.5">
                        <Label htmlFor="soa-company">Company</Label>
                        <Select
                            value={companies.selectedId === null ? "" : String(companies.selectedId)}
                            onValueChange={(next) => companies.selectById(next === "" ? null : Number(next))}
                            disabled={companies.loading || companies.options.length === 0}
                        >
                            <SelectTrigger id="soa-company">
                                <SelectValue placeholder={companies.loading ? "Loading…" : "Select company"} />
                            </SelectTrigger>
                            <SelectContent>
                                {companies.options.map((option) => (
                                    <SelectItem key={option.id} value={String(option.id)}>
                                        {option.company_name} ({option.company_code})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {companies.unreachable && (
                        <p className="text-sm text-muted-foreground">
                            Company list is unreachable. The letterhead prints without company details.
                        </p>
                    )}
                </CardContent>
            </Card>
            )}

            {sections.length === 0 && (
                <Alert>
                    <AlertDescription>
                        This request has no statement-of-account rows, so there is nothing to enter lines for.
                    </AlertDescription>
                </Alert>
            )}

            {sections.map((section) => (
                <Card key={section.key}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm">{section.label}</CardTitle>
                        {!isApproved && (
                            <Button variant="outline" size="sm" onClick={() => addRow(section.key)}>
                                <Plus className="h-4 w-4" aria-hidden="true" />
                                Add line
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {(drafts[section.key] ?? []).map((row) => {
                            const invalid = !isAmountValid(row.amountText);
                            return (
                                <div
                                    key={row.key}
                                    className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_160px_1fr_auto]"
                                >
                                    <div className="grid gap-1.5">
                                        <Label>Description</Label>
                                        <Input
                                            value={row.description}
                                            disabled={isApproved}
                                            placeholder="Description"
                                            onChange={(event) =>
                                                updateRow(section.key, row.key, { description: event.target.value })
                                            }
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label>Amount</Label>
                                        <Input
                                            value={row.amountText}
                                            disabled={isApproved}
                                            inputMode="decimal"
                                            placeholder="0.00"
                                            aria-invalid={invalid}
                                            className={invalid ? "border-destructive" : undefined}
                                            onChange={(event) =>
                                                updateRow(section.key, row.key, { amountText: event.target.value })
                                            }
                                        />
                                        {invalid && (
                                            <p className="text-xs text-destructive">
                                                Enter a valid amount of zero or more.
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label>Remarks</Label>
                                        <Input
                                            value={row.remarks}
                                            disabled={isApproved}
                                            placeholder="Remarks"
                                            onChange={(event) =>
                                                updateRow(section.key, row.key, { remarks: event.target.value })
                                            }
                                        />
                                    </div>
                                    {!isApproved && (
                                        <div className="flex items-end">
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
                        {(drafts[section.key] ?? []).length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                No lines for this category. Saved lines replace everything already stored.
                            </p>
                        )}
                    </CardContent>
                </Card>
            ))}

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Signatories</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-3">
                    {signatoryDrafts.map((draft, index) => (
                        <div key={`signatory-${index}`} className="grid gap-2 rounded-md border p-3">
                            <p className="text-sm font-medium">
                                {draft.label === "" ? "Additional Signatory" : draft.label}
                            </p>
                            <div className="grid gap-1.5">
                                <Label>Name</Label>
                                <Input
                                    value={draft.name}
                                    disabled={isApproved}
                                    placeholder="Name"
                                    onChange={(event) => updateSignatory(index, "name", event.target.value)}
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <Label>Title</Label>
                                <Input
                                    value={draft.title}
                                    disabled={isApproved}
                                    placeholder="Title"
                                    onChange={(event) => updateSignatory(index, "title", event.target.value)}
                                />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <SoaPrintDialog
                soaId={detail?.id ?? null}
                pdfFile={detail?.pdf_file ?? null}
                model={model}
                fileName={model ? toFileName(model.employeeName, model.refNo) : ""}
                open={printOpen}
                onOpenChange={setPrintOpen}
            />
        </div>
    );
}
