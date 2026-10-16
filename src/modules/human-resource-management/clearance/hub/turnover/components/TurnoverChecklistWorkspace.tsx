"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { Check, Eye, Loader2, Printer, RefreshCw, Save, Upload } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
    approveTurnover,
    getTurnoverByRequest,
    saveTurnover,
    turnoverErrorMessage,
} from "../providers/turnoverClient";
import {
    TURNOVER_CERTIFICATION_TEXT,
    TURNOVER_GENERAL_FIELDS,
    TURNOVER_SECTIONS,
    countSectionDone,
    createEmptyTurnoverData,
    turnoverOfficerKey,
    type ClearanceTurnoverRow,
    type TurnoverCertification,
    type TurnoverData,
    type TurnoverGeneral,
    type TurnoverPrintInput,
    type TurnoverSection,
} from "../types";
import { buildTurnoverPrintPdfBytes } from "../utils/turnoverPrintPdf";
import {
    companyLogoDataUrl,
    fetchEmployeeCompany,
    pickDefaultCompany,
    pickEmployeeCompany,
} from "../../utils/company";
import { LiveDocumentPreview } from "../../components/LiveDocumentPreview";
import { useCompanyOptions } from "../../form/hooks/useCompanyOptions";
import { Turnover201Dialog } from "./Turnover201Dialog";
import { TurnoverPrintDialog } from "./TurnoverPrintDialog";

interface TurnoverChecklistWorkspaceProps {
    requestId: number;
    employeeName: string | null;
    onChanged: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function sectionHeading(section: TurnoverSection): string {
    return section.number === null ? section.title : `${section.number}. ${section.title}`;
}

function WorkspaceSkeletons(): JSX.Element {
    return (
        <div className="space-y-6" aria-label="Loading turnover checklist">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
    );
}

export function TurnoverChecklistWorkspace({
    requestId,
    employeeName,
    onChanged,
}: TurnoverChecklistWorkspaceProps): JSX.Element {
    const [row, setRow] = useState<ClearanceTurnoverRow | null>(null);
    const [data, setData] = useState<TurnoverData>(() => createEmptyTurnoverData());
    const [savedSnapshot, setSavedSnapshot] = useState("");
    const [completed, setCompleted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [saving, setSaving] = useState(false);
    const [approving, setApproving] = useState(false);
    const [printOpen, setPrintOpen] = useState(false);
    const [dialog201Open, setDialog201Open] = useState(false);
    const { options: companies } = useCompanyOptions();
    const [employeeCompanyId, setEmployeeCompanyId] = useState<number | null | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const loaded = await getTurnoverByRequest(requestId);
                if (cancelled) return;
                setRow(loaded);
                setData(loaded.data);
                setSavedSnapshot(JSON.stringify(loaded.data));
            } catch (err) {
                if (!cancelled) {
                    setRow(null);
                    setError(turnoverErrorMessage(err, "Could not load the turnover checklist. Please try again."));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [requestId, reloadKey]);

    useEffect(() => {
        let cancelled = false;
        setEmployeeCompanyId(undefined);
        (async () => {
            try {
                const result = await fetchEmployeeCompany({ requestId });
                if (!cancelled) setEmployeeCompanyId(result.company_id);
            } catch {
                if (!cancelled) setEmployeeCompanyId(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [requestId]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/hrm/clearance/requests/${requestId}`, { cache: "no-store" });
                const body: unknown = await res.json().catch(() => null);
                if (cancelled) return;
                const status = isRecord(body) && isRecord(body.data) ? body.data.status : null;
                setCompleted(status === "completed");
            } catch {
                if (!cancelled) setCompleted(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [requestId]);

    useEffect(() => {
        if (row === null) return;
        const name = employeeName === null ? "" : employeeName.trim();
        if (name === "") return;
        setData((prev) => {
            const general = prev.general.employee_name === ""
                ? { ...prev.general, employee_name: name }
                : prev.general;
            const certification = prev.certification.employee_name === ""
                ? { ...prev.certification, employee_name: name }
                : prev.certification;
            if (general === prev.general && certification === prev.certification) return prev;
            return { ...prev, general, certification };
        });
    }, [row, employeeName]);

    const selectedCompany = useMemo(() => {
        const employeeCompany = typeof employeeCompanyId === "number"
            ? pickEmployeeCompany(companies, employeeCompanyId)
            : null;
        return employeeCompany ?? pickDefaultCompany(companies);
    }, [companies, employeeCompanyId]);

    const isApproved = row?.status === "approved";
    const readOnly = isApproved || completed;
    const hasUpload = row !== null && row.pdf_file !== null && row.pdf_file !== "";
    const dirty = row !== null && JSON.stringify(data) !== savedSnapshot;

    const printInput = useMemo<TurnoverPrintInput | null>(() => {
        if (row === null) return null;
        const name = employeeName !== null && employeeName.trim() !== ""
            ? employeeName
            : data.general.employee_name.trim() === ""
                ? null
                : data.general.employee_name;
        return {
            data,
            refNo: row.ref_no,
            requestId,
            employeeName: name,
            companyName: selectedCompany?.company_name ?? null,
            company_address: selectedCompany?.company_address ?? null,
            company_contact: selectedCompany?.company_contact ?? null,
            company_email: selectedCompany?.company_email ?? null,
            logoDataUrl: companyLogoDataUrl(selectedCompany),
        };
    }, [row, data, requestId, employeeName, selectedCompany]);

    const buildPreviewPdf = useCallback((): Uint8Array => {
        if (printInput === null) {
            return new Uint8Array();
        }
        return buildTurnoverPrintPdfBytes(printInput);
    }, [printInput]);

    const previewRevision = useMemo(() => JSON.stringify(printInput), [printInput]);

    function updateGeneral(key: keyof TurnoverGeneral, value: string): void {
        setData((prev) => ({ ...prev, general: { ...prev.general, [key]: value } }));
    }

    function updateCertification(key: keyof TurnoverCertification, value: string): void {
        setData((prev) => ({ ...prev, certification: { ...prev.certification, [key]: value } }));
    }

    function updateOfficer(key: string, value: string): void {
        setData((prev) => ({ ...prev, officers: { ...prev.officers, [key]: value } }));
    }

    function updateItemDone(itemId: string, done: boolean): void {
        setData((prev) => ({
            ...prev,
            items: { ...prev.items, [itemId]: { done, remarks: prev.items[itemId]?.remarks ?? "" } },
        }));
    }

    function updateItemRemarks(itemId: string, remarks: string): void {
        setData((prev) => ({
            ...prev,
            items: { ...prev.items, [itemId]: { done: prev.items[itemId]?.done ?? false, remarks } },
        }));
    }

    async function handleSave(): Promise<void> {
        if (row === null || saving || readOnly || !dirty) return;
        setSaving(true);
        try {
            const updated = await saveTurnover(row.id, data);
            setRow(updated);
            setData(updated.data);
            setSavedSnapshot(JSON.stringify(updated.data));
            toast.success("Turnover checklist saved.");
            onChanged();
        } catch (err) {
            toast.error(turnoverErrorMessage(err, "Could not save the turnover checklist. Please try again."));
        } finally {
            setSaving(false);
        }
    }

    async function handleApprove(): Promise<void> {
        if (row === null || approving || readOnly) return;
        if (!hasUpload) {
            toast.error("Upload the turnover checklist PDF to the 201 file before approving.");
            return;
        }
        const companyCode = selectedCompany?.company_code ?? "";
        if (companyCode.trim() === "") {
            toast.error("Set the employee company before approving.");
            return;
        }
        setApproving(true);
        try {
            await approveTurnover(row.id, companyCode.trim());
            toast.success("Turnover checklist approved.");
            setReloadKey((value) => value + 1);
            onChanged();
        } catch (err) {
            toast.error(turnoverErrorMessage(err, "Could not approve the turnover checklist. Please try again."));
        } finally {
            setApproving(false);
        }
    }

    async function handleRefresh(): Promise<void> {
        setReloadKey((value) => value + 1);
        await Promise.resolve();
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Turnover Checklist</h2>
                    <p className="text-sm text-muted-foreground">
                        Upload the turnover checklist PDF to the 201 file to enable approval.
                    </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                        variant="default"
                        size="sm"
                        className="min-h-11 w-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 sm:w-auto md:min-h-0"
                        onClick={() => void handleSave()}
                        disabled={!dirty || saving || readOnly}
                        aria-label="Save turnover checklist"
                        title="Save turnover checklist"
                    >
                        <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                        {saving ? "Saving…" : "Save"}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11 w-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 sm:w-auto md:min-h-0"
                        onClick={() => setPrintOpen(true)}
                        disabled={row === null}
                        aria-label="Print turnover checklist"
                        title="Print turnover checklist"
                    >
                        <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
                        Print
                    </Button>
                    <Button
                        type="button"
                        variant={hasUpload ? "outline" : "default"}
                        size="sm"
                        className="min-h-11 w-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 sm:w-auto md:min-h-0"
                        onClick={() => setDialog201Open(true)}
                        disabled={readOnly && !hasUpload}
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
                    {!readOnly ? (
                        <span
                            title={
                                hasUpload
                                    ? "Approve turnover checklist"
                                    : "Upload the turnover checklist PDF to the 201 file before approving."
                            }
                        >
                            <Button
                                variant="default"
                                size="sm"
                                className="min-h-11 w-full bg-success text-success-foreground hover:bg-success/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 sm:w-auto md:min-h-0"
                                onClick={() => void handleApprove()}
                                disabled={approving || !hasUpload}
                                aria-label="Approve turnover checklist"
                            >
                                {approving ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                ) : (
                                    <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                                )}
                                {approving ? "Approving…" : "Approve"}
                            </Button>
                        </span>
                    ) : null}
                </div>
            </div>

            {loading && row === null ? (
                <WorkspaceSkeletons />
            ) : error || row === null ? (
                <Alert variant="destructive">
                    <AlertTitle>Workspace unavailable</AlertTitle>
                    <AlertDescription className="space-y-3">
                        <p>{error ?? "This workspace could not be loaded."}</p>
                        <Button variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={loading}>
                            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                            Retry
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : (
                <>
                    {completed ? (
                        <Alert>
                            <AlertTitle>Completed</AlertTitle>
                            <AlertDescription>
                                This clearance is complete and the turnover checklist is read-only.
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    {!readOnly && hasUpload ? (
                        <p className="text-xs text-muted-foreground">
                            Signed copy filed to the 201 file. Replacing it overwrites the filed copy.
                        </p>
                    ) : null}

                    <div className="grid gap-6 lg:grid-cols-[520px_minmax(0,1fr)] xl:grid-cols-[560px_minmax(0,1fr)] items-start">
                        <div className="min-w-0 space-y-4">
                            <Card>
                                <CardHeader className="border-b pb-4">
                                    <CardTitle className="text-base">General Information</CardTitle>
                                </CardHeader>
                                <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
                                    {TURNOVER_GENERAL_FIELDS.map((field) => {
                                        const inputId = `turnover-general-${field.key}`;
                                        return (
                                            <div key={field.key} className="grid gap-1.5">
                                                <Label htmlFor={inputId}>{field.label}</Label>
                                                <Input
                                                    id={inputId}
                                                    value={data.general[field.key]}
                                                    disabled={readOnly}
                                                    onChange={(event) => updateGeneral(field.key, event.target.value)}
                                                />
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>

                            {TURNOVER_SECTIONS.map((section) => {
                                const done = countSectionDone(section, data);
                                const total = section.items.length;
                                return (
                                    <Card key={section.id}>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                            <CardTitle className="text-sm">{sectionHeading(section)}</CardTitle>
                                            <span className="text-xs text-muted-foreground tabular-nums">
                                                {done}/{total}
                                            </span>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            {section.items.map((item) => {
                                                const value = data.items[item.id] ?? { done: false, remarks: "" };
                                                const doneId = `turnover-${item.id}-done`;
                                                const remarksId = `turnover-${item.id}-remarks`;
                                                return (
                                                    <div
                                                        key={item.id}
                                                        className="grid gap-2 rounded-md border p-3 sm:grid-cols-[auto_minmax(0,1fr)_220px]"
                                                    >
                                                        <div className="flex items-center">
                                                            <Checkbox
                                                                id={doneId}
                                                                checked={value.done}
                                                                disabled={readOnly}
                                                                onCheckedChange={(checked) =>
                                                                    updateItemDone(item.id, checked === true)
                                                                }
                                                            />
                                                        </div>
                                                        <Label
                                                            htmlFor={doneId}
                                                            className="flex cursor-pointer items-center text-sm font-normal leading-snug"
                                                        >
                                                            {item.label}
                                                        </Label>
                                                        <Input
                                                            id={remarksId}
                                                            value={value.remarks}
                                                            disabled={readOnly}
                                                            placeholder="Remarks"
                                                            aria-label={`Remarks for ${item.label}`}
                                                            onChange={(event) =>
                                                                updateItemRemarks(item.id, event.target.value)
                                                            }
                                                        />
                                                    </div>
                                                );
                                            })}
                                            <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
                                                {section.officers.map((officer, index) => {
                                                    const officerId = `turnover-${section.id}-officer-${index}`;
                                                    const officerKey = turnoverOfficerKey(section.id, index);
                                                    return (
                                                        <div key={officerKey} className="grid gap-1.5">
                                                            <Label htmlFor={officerId}>{officer}</Label>
                                                            <Input
                                                                id={officerId}
                                                                value={data.officers[officerKey] ?? ""}
                                                                disabled={readOnly}
                                                                placeholder="Signature Over Printed Name"
                                                                onChange={(event) =>
                                                                    updateOfficer(officerKey, event.target.value)
                                                                }
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}

                            <Card>
                                <CardHeader className="border-b pb-4">
                                    <CardTitle className="text-base">Certification</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 pt-6">
                                    <p className="text-sm text-muted-foreground">{TURNOVER_CERTIFICATION_TEXT}</p>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="turnover-certification-name">Employee Name</Label>
                                            <Input
                                                id="turnover-certification-name"
                                                value={data.certification.employee_name}
                                                disabled={readOnly}
                                                onChange={(event) =>
                                                    updateCertification("employee_name", event.target.value)
                                                }
                                            />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="turnover-certification-date">Date</Label>
                                            <Input
                                                id="turnover-certification-date"
                                                value={data.certification.date}
                                                disabled={readOnly}
                                                onChange={(event) => updateCertification("date", event.target.value)}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        <div className="lg:sticky lg:top-4">
                            <LiveDocumentPreview
                                build={buildPreviewPdf}
                                revision={previewRevision}
                                title="Turnover checklist live preview"
                                loadingLabel="Generating PDF preview…"
                                unavailable={printInput === null}
                                unavailableLabel="Loading turnover checklist…"
                                caption="Live preview updates as fields change."
                            />
                        </div>
                    </div>
                </>
            )}

            {row !== null ? (
                <Turnover201Dialog
                    open={dialog201Open}
                    onOpenChange={setDialog201Open}
                    documentId={row.id}
                    pdfFile={row.pdf_file}
                    description={`${(employeeName ?? "").trim() || data.general.employee_name.trim() || "—"}${row.ref_no ? ` — REF ${row.ref_no}` : ""}`}
                    readOnly={readOnly}
                    onUploaded={() => {
                        setReloadKey((value) => value + 1);
                        onChanged();
                    }}
                />
            ) : null}

            <TurnoverPrintDialog open={printOpen} onOpenChange={setPrintOpen} input={printInput} />
        </div>
    );
}
