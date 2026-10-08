"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { Check, Loader2, Printer, RefreshCw, Save, Upload } from "lucide-react";
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
import { buildClearancePdf, type ClearancePrintEntry } from "../utils/clearancePrintPdf";
import { toFormUploadFileName, uploadFormPdf } from "../utils/formPdfUpload";
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
    const [gmName, setGmName] = useState("");
    const [gmTitle, setGmTitle] = useState("");
    const [savedGm, setSavedGm] = useState<{ name: string; title: string } | null>(null);
    const [gmSaving, setGmSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [approving, setApproving] = useState(false);
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

    const handleUpload = useCallback(async () => {
        if (!form || uploading || detail?.status === "completed" || form.status === "approved") return;
        setUploading(true);
        try {
            const selected = await resolveCompany();
            const params = new URLSearchParams({
                request_id: String(requestId),
                date: phToday(),
                ref_no: form.ref_no ?? "",
            });
            const res = await fetch(`/api/hrm/clearance/form/render-model?${params.toString()}`);
            const body: unknown = await res.json().catch(() => null);
            if (!res.ok || !isRecord(body) || body.success !== true || !isRecord(body.data)) {
                throw new Error("Could not build the clearance PDF. Please try again.");
            }
            const model = body.data as ClearanceFormRenderModel;
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
                company_name: model.company_name ?? selected?.company_name,
                company_address: model.company_address ?? selected?.company_address ?? null,
                logo_data_url: model.logo_data_url ?? (selected ? companyLogoDataUrl(selected) : null),
                gmName,
                gmTitle,
            });
            const bytes = new Uint8Array(await blob.arrayBuffer());
            const result = await uploadFormPdf({
                documentId: form.id,
                bytes,
                fileName: toFormUploadFileName(model.employeeName, model.refNo),
            });
            await refreshFormRow();
            toast.success(
                result.alreadyFiled
                    ? "Clearance PDF replaced in the 201 file."
                    : "Clearance PDF uploaded to the 201 file."
            );
            refresh();
            await documents.refresh();
            onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not upload the clearance PDF. Please try again.");
        } finally {
            setUploading(false);
        }
    }, [form, uploading, detail, requestId, resolveCompany, gmName, gmTitle, refreshFormRow, refresh, documents, onChanged]);

    const hasUpload = form !== null && form.pdf_file !== null && form.pdf_file !== "";
    const isApproved = form?.status === "approved";
    const formReadonly = isCompleted || isApproved;
    const showUpload = form !== null && !isCompleted;
    const showApprove = form !== null && !isApproved && !isCompleted;
    const approveBlocked = !hasUpload;
    const approveDisabled = approving || uploading || approveBlocked;

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
            <div className="flex flex-col sm:flex-row sm:justify-end">
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
                    {showUpload ? (
                        <Button
                            variant="default"
                            size="sm"
                            className="min-h-11 w-full bg-purple-600 text-white hover:bg-purple-700 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 sm:w-auto md:min-h-0"
                            onClick={() => void handleUpload()}
                            disabled={uploading || approving || formReadonly}
                            aria-label="Upload clearance PDF to the 201 file"
                            title="Upload clearance PDF to the 201 file"
                        >
                            {uploading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                            )}
                            {uploading ? "Uploading…" : hasUpload ? "Re-upload to 201" : "Upload to 201"}
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
                </div>
                {showApprove && approveBlocked ? (
                    <p className="mt-2 text-xs text-muted-foreground sm:text-right">
                        Upload the clearance PDF to the 201 file before approving.
                    </p>
                ) : null}
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
                <div className="space-y-6">
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
            )}

            {form ? (
                <ClearanceFormPrintDialog
                    form={form}
                    open={printOpen}
                    onOpenChange={setPrintOpen}
                    onSaved={() => void handleFormSaved()}
                />
            ) : null}
        </div>
    );
}
