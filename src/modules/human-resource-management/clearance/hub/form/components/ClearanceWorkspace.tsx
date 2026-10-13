"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { Check, Eye, Loader2, Printer, RefreshCw, Save, Upload } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClearanceFormSchema, type ClearanceForm, type ClearanceFormRenderModel } from "../types";
import { useClearanceWorkspace } from "../hooks/useClearanceWorkspace";
import { useCompanyOptions } from "../hooks/useCompanyOptions";
import { useFormDocumentGate } from "../hooks/useFormDocumentGate";
import { useRequestSignatories } from "../hooks/useRequestSignatories";
import {
    companyLogoDataUrl,
    fetchEmployeeCompany,
    pickDefaultCompany,
    pickEmployeeCompany,
    type CompanyOption,
} from "../../utils/company";
import { phToday } from "../../utils/time";
import { LiveDocumentPreview } from "../../components/LiveDocumentPreview";
import {
    buildClearancePdfBytes,
    type ClearancePrintEntry,
    type ClearancePrintInput,
} from "../utils/clearancePrintPdf";
import { ClearanceForm201Dialog } from "./ClearanceForm201Dialog";
import { ClearanceFormPrintDialog } from "./ClearanceFormPrintDialog";
import { GmSignatoryCard } from "./GmSignatoryCard";
import { SignatoryAssignmentCard } from "./SignatoryAssignmentCard";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function WorkspaceSkeletons(): JSX.Element {
    return (
        <div className="space-y-6" aria-label="Loading workspace">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-96 w-full" />
        </div>
    );
}

interface ClearanceWorkspaceProps {
    requestId: number;
    employeeName: string | null;
    onBack: () => void;
    onChanged: () => void;
    autoPrint?: boolean;
}

export function ClearanceWorkspace({
    requestId,
    employeeName,
    onChanged,
    autoPrint = false,
}: ClearanceWorkspaceProps): JSX.Element {
    const { detail, isLoading, error, refresh } =
        useClearanceWorkspace(requestId, employeeName);
    const [form, setForm] = useState<ClearanceForm | null>(null);
    const [printOpen, setPrintOpen] = useState(false);
    const [form201Open, setForm201Open] = useState(false);
    const [gmName, setGmName] = useState("");
    const [gmTitle, setGmTitle] = useState("");
    const [savedGm, setSavedGm] = useState<{ name: string; title: string } | null>(null);
    const [gmSaving, setGmSaving] = useState(false);
    const [approving, setApproving] = useState(false);
    const [previewModel, setPreviewModel] = useState<ClearanceFormRenderModel | null>(null);
    const [previewCompany, setPreviewCompany] = useState<CompanyOption | null>(null);
    const { options: companies } = useCompanyOptions();
    const autoPrintSeenRef = useRef<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/hrm/clearance/form/by-request?request_id=${requestId}`, {
                    cache: "no-store",
                });
                if (!res.ok) return;
                const body: unknown = await res.json().catch(() => null);
                if (
                    typeof body !== "object" ||
                    body === null ||
                    (body as { success?: unknown }).success !== true
                ) {
                    return;
                }
                const parsed = ClearanceFormSchema.safeParse((body as { data?: unknown }).data);
                if (!parsed.success || cancelled) return;
                setForm(parsed.data);
                setGmName(parsed.data.gm_name ?? "");
                setGmTitle(parsed.data.gm_title ?? "");
                setSavedGm({ name: parsed.data.gm_name ?? "", title: parsed.data.gm_title ?? "" });
                if (autoPrint && autoPrintSeenRef.current !== requestId) {
                    autoPrintSeenRef.current = requestId;
                    setPrintOpen(true);
                }
            } catch {
                return;
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [requestId, autoPrint]);

    const documents = useFormDocumentGate(requestId, detail?.user_id ?? null);
    const isCompleted = detail?.status === "completed";

    const {
        items,
        candidates,
        selections,
        setSelection,
        changedCount,
        isLoading: signatoriesLoading,
        error: signatoriesError,
        isSaving,
        refresh: refreshSignatories,
        save: saveSignatories,
    } = useRequestSignatories(requestId);

    const gmDirty = savedGm !== null && (gmName !== savedGm.name || gmTitle !== savedGm.title);

    const handleSave = useCallback(async () => {
        const didSignatories = changedCount > 0;
        const didGm = gmDirty;
        if ((!didSignatories && !didGm) || !form || form.status === "approved" || detail?.status === "completed") return;
        if (didGm) setGmSaving(true);
        try {
            await saveSignatories();
            if (didGm) {
                const res = await fetch(`/api/hrm/clearance/form/${form.id}/gm`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ gm_name: gmName, gm_title: gmTitle }),
                });
                const payload: unknown = await res.json().catch(() => null);
                if (!res.ok || !isRecord(payload) || payload.success !== true) {
                    const message = isRecord(payload) && typeof payload.message === "string" && payload.message.trim() !== ""
                        ? payload.message
                        : "Could not save the general manager. Please try again.";
                    throw new Error(message);
                }
                setSavedGm({ name: gmName, title: gmTitle });
            }
            if (didSignatories && didGm) {
                toast.success("Signatories and general manager saved");
            } else if (didGm) {
                toast.success("General manager saved");
            } else {
                toast.success("Signatories saved");
            }
            refresh();
            onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to save changes");
        } finally {
            setGmSaving(false);
        }
    }, [saveSignatories, refresh, onChanged, gmDirty, gmName, gmTitle, form, changedCount, detail]);

    const resolveCompany = useCallback(async (): Promise<CompanyOption | null> => {
        let companyId: number | null = null;
        try {
            companyId = (await fetchEmployeeCompany({ requestId })).company_id;
        } catch {
            companyId = null;
        }
        if (companyId !== null) {
            const employeeCompany = pickEmployeeCompany(companies, companyId);
            if (employeeCompany) return employeeCompany;
        }
        if (form?.company_code) {
            const byForm = pickDefaultCompany(companies, form.company_code);
            if (byForm) return byForm;
        }
        return pickDefaultCompany(companies);
    }, [requestId, companies, form]);

    useEffect(() => {
        setPreviewModel(null);
    }, [requestId]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const params = new URLSearchParams({
                    request_id: String(requestId),
                    date: phToday(),
                    ref_no: form?.ref_no ?? "",
                });
                const res = await fetch(`/api/hrm/clearance/form/render-model?${params.toString()}`);
                const body: unknown = await res.json().catch(() => null);
                if (!res.ok || !isRecord(body) || body.success !== true || !isRecord(body.data)) {
                    return;
                }
                if (!cancelled) setPreviewModel(body.data as ClearanceFormRenderModel);
            } catch {
                return;
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [requestId, form?.ref_no, items]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const selected = await resolveCompany();
                if (!cancelled) setPreviewCompany(selected);
            } catch {
                if (!cancelled) setPreviewCompany(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [resolveCompany]);

    const printInput = useMemo((): ClearancePrintInput | null => {
        if (previewModel === null) return null;
        const entries: ClearancePrintEntry[] = previewModel.roles.map((role, index) => {
            const item = items[index] ?? null;
            let signeeName = role.signeeName;
            if (item !== null && role.label === item.label_snapshot && item.id in selections) {
                const selected = selections[item.id] ?? null;
                if (selected !== item.signatory_id) {
                    if (selected === null) {
                        signeeName = "";
                    } else {
                        const match = (candidates[item.id] ?? []).find((entry) => entry.user_id === selected) ?? null;
                        signeeName = match?.full_name ?? role.signeeName;
                    }
                }
            }
            return {
                category: role.label,
                signeeName,
                signatureDataUrl: null,
                remarks: role.remarks,
            };
        });
        return {
            employeeName: previewModel.employeeName,
            entries,
            refNo: previewModel.refNo,
            date: previewModel.date,
            position: previewModel.position,
            company_name: previewModel.company_name ?? previewCompany?.company_name,
            company_address: previewModel.company_address ?? previewCompany?.company_address ?? null,
            logo_data_url: previewModel.logo_data_url ?? (previewCompany ? companyLogoDataUrl(previewCompany) : null),
            gmName,
            gmTitle,
        };
    }, [previewModel, items, selections, candidates, previewCompany, gmName, gmTitle]);

    const buildPreviewPdf = useCallback((): Uint8Array => {
        if (printInput === null) {
            return new Uint8Array();
        }
        return buildClearancePdfBytes(printInput);
    }, [printInput]);

    const previewRevision = useMemo(() => JSON.stringify(printInput), [printInput]);

    const refreshFormRow = useCallback(async (): Promise<void> => {
        try {
            const res = await fetch(`/api/hrm/clearance/form/by-request?request_id=${requestId}`, {
                cache: "no-store",
            });
            if (!res.ok) return;
            const body: unknown = await res.json().catch(() => null);
            if (!isRecord(body) || body.success !== true) return;
            const parsed = ClearanceFormSchema.safeParse((body as { data?: unknown }).data);
            if (!parsed.success) return;
            setForm(parsed.data);
        } catch {
            return;
        }
    }, [requestId]);

    const handleForm201Uploaded = useCallback(async (): Promise<void> => {
        await refreshFormRow();
        refresh();
        await documents.refresh();
        onChanged();
    }, [refreshFormRow, refresh, documents, onChanged]);

    const hasUpload = form !== null && form.pdf_file !== null && form.pdf_file !== "";
    const isApproved = form?.status === "approved";
    const formReadonly = isCompleted || isApproved;
    const showUpload = form !== null && !isCompleted;
    const showApprove = form !== null && !isApproved && !isCompleted;
    const approveBlocked = !hasUpload;
    const approveDisabled = approving || approveBlocked;

    const handleApprove = useCallback(async () => {
        if (!form || approving) return;
        if (!hasUpload) {
            toast.error("Upload the clearance PDF to the 201 file before approving.");
            return;
        }
        const selected = await resolveCompany();
        const companyCode = selected?.company_code ?? form.company_code ?? "";
        if (companyCode.trim() === "") {
            toast.error("Set the employee company before approving.");
            return;
        }
        setApproving(true);
        try {
            const res = await fetch("/api/hrm/clearance/form/approve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    request_id: requestId,
                    company_code: companyCode.trim(),
                    date: phToday(),
                }),
            });
            const payload: unknown = await res.json().catch(() => null);
            if (!res.ok || !isRecord(payload) || payload.success !== true) {
                const message = isRecord(payload) && typeof payload.message === "string" && payload.message.trim() !== ""
                    ? payload.message
                    : "Could not approve the clearance form. Please try again.";
                throw new Error(message);
            }
            toast.success("Clearance form approved.");
            await refreshFormRow();
            refresh();
            await documents.refresh();
            onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not approve the clearance form. Please try again.");
        } finally {
            setApproving(false);
        }
    }, [form, approving, hasUpload, resolveCompany, requestId, refreshFormRow, refresh, documents, onChanged]);

    const handleRefresh = useCallback(async () => {
        refresh();
        refreshSignatories();
        await documents.refresh();
        await Promise.resolve();
        onChanged();
    }, [refresh, refreshSignatories, documents, onChanged]);

    const handleFormSaved = useCallback(async () => {
        try {
            const res = await fetch(`/api/hrm/clearance/form/by-request?request_id=${requestId}`, {
                cache: "no-store",
            });
            if (!res.ok) return;
            const body: unknown = await res.json().catch(() => null);
            if (
                typeof body !== "object" ||
                body === null ||
                (body as { success?: unknown }).success !== true
            ) {
                return;
            }
            const parsed = ClearanceFormSchema.safeParse((body as { data?: unknown }).data);
            if (!parsed.success) return;
            setForm(parsed.data);
        } catch {
            return;
        }
        onChanged();
    }, [requestId, onChanged]);

    const totalChanges = changedCount + (gmDirty ? 1 : 0);
    const saveDisabled = isSaving || gmSaving || signatoriesLoading || totalChanges === 0 || formReadonly;

    return (
        <div className="mx-auto min-h-screen max-w-[1600px] space-y-6 p-2 sm:p-6 md:p-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Clearance Form</h2>
                    <p className="text-sm text-muted-foreground">
                        Upload the clearance form PDF to the 201 file to enable approval.
                    </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                        variant="default"
                        size="sm"
                        className="min-h-11 w-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 sm:w-auto md:min-h-0"
                        onClick={() => void handleSave()}
                        disabled={saveDisabled}
                        aria-label="Save signatories"
                        title="Save signatories"
                    >
                        <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                        {isSaving || gmSaving ? "Saving…" : "Save"}
                    </Button>
                    {form ? (
                        <Button
                            variant="outline"
                            size="sm"
                            className="min-h-11 w-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 sm:w-auto md:min-h-0"
                            onClick={() => setPrintOpen(true)}
                            aria-label="Print clearance form"
                            title="Print clearance form"
                        >
                            <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
                            Print
                        </Button>
                    ) : null}
                    {showUpload ? (
                        <Button
                            type="button"
                            variant={hasUpload ? "outline" : "default"}
                            size="sm"
                            className="min-h-11 w-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 sm:w-auto md:min-h-0"
                            onClick={() => setForm201Open(true)}
                            disabled={formReadonly}
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
                    ) : null}
                    {showApprove ? (
                        <span
                            title={
                                approveBlocked
                                    ? "Upload the clearance PDF to the 201 file before approving."
                                    : "Approve clearance form"
                            }
                        >
                            <Button
                                variant="default"
                                size="sm"
                                className="min-h-11 w-full bg-success text-success-foreground hover:bg-success/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 sm:w-auto md:min-h-0"
                                onClick={() => void handleApprove()}
                                disabled={approveDisabled}
                                aria-label="Approve clearance form"
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

            {isLoading && !detail ? (
                <WorkspaceSkeletons />
            ) : error || !detail ? (
                <Alert variant="destructive">
                    <AlertTitle>Workspace unavailable</AlertTitle>
                    <AlertDescription className="space-y-3">
                        <p>{error ?? "This workspace could not be loaded."}</p>
                        <Button variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={isLoading}>
                            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                            Retry
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : (
                <div className="grid gap-6 lg:grid-cols-[520px_minmax(0,1fr)] xl:grid-cols-[560px_minmax(0,1fr)] items-start">
                    <div className="min-w-0 space-y-6">
                    {isCompleted ? (
                        <Alert>
                            <AlertTitle>Completed</AlertTitle>
                            <AlertDescription>
                                This clearance is complete and read-only.
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    <SignatoryAssignmentCard
                        items={items}
                        candidates={candidates}
                        selections={selections}
                        onSelect={setSelection}
                        disabled={isSaving || formReadonly}
                        isLoading={signatoriesLoading}
                        error={signatoriesError}
                        onRetry={refreshSignatories}
                    />

                    {form ? (
                        <GmSignatoryCard
                            gmName={gmName}
                            gmTitle={gmTitle}
                            onNameChange={setGmName}
                            onTitleChange={setGmTitle}
                            disabled={isSaving || gmSaving || formReadonly}
                        />
                    ) : null}
                    </div>
                    <div className="min-w-0 space-y-6">
                        <LiveDocumentPreview
                            build={buildPreviewPdf}
                            revision={previewRevision}
                            title="Clearance form live preview"
                            loadingLabel="Generating PDF preview…"
                            unavailable={previewModel === null}
                            unavailableLabel="Loading clearance form…"
                            caption="Live preview updates as fields change."
                        />
                    </div>
                </div>
            )}

            {form ? (
                <ClearanceFormPrintDialog
                    form={form}
                    open={printOpen}
                    onOpenChange={setPrintOpen}
                    onSaved={() => void handleFormSaved()}
                />
            ) : null}

            {form ? (
                <ClearanceForm201Dialog
                    open={form201Open}
                    onOpenChange={setForm201Open}
                    documentId={form.id}
                    pdfFile={form.pdf_file}
                    description={`${employeeName ?? "—"}${form.ref_no ? ` — REF ${form.ref_no}` : ""}`}
                    readOnly={formReadonly}
                    onUploaded={() => void handleForm201Uploaded()}
                />
            ) : null}
        </div>
    );
}
