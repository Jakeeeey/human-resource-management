"use client";

import React from "react";
import { AlertCircle, Briefcase, CheckCircle2, GraduationCap, Loader2, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
    HireGateResponseSchema,
    type HireGateState,
} from "../../hire/types/hire-gate.schema";
import type { WorkspacePhaseGroup } from "../../hub/workspaceTasks";
import { TrainingTab } from "../../hub/components/TrainingTab";
import { EmploymentRecommendationStep } from "./EmploymentRecommendationStep";
import type { EmploymentRecommendationAssembled } from "../server/employmentRecommendationInput";
import { PreEmploymentTrainingLetterForm } from "./PreEmploymentTrainingLetterForm";
import { PreEmploymentTrainingLetterSign, type SignedTrainingLetter } from "./PreEmploymentTrainingLetterSign";
import type {
    GeneratedTrainingLetter,
    PreEmploymentTrainingFormData,
    PreEmploymentTrainingLetterPrefill,
} from "./types";

export interface PreEmploymentTrainingSectionProps {
    applicantId: number;
    userId: number;
    applicantStatus?: string;
    prefill?: PreEmploymentTrainingLetterPrefill;
    trainingGroups?: WorkspacePhaseGroup[];
    trainingLoading?: boolean;
    trainingError?: string | null;
    onTrainingRefresh?: () => void;
}

type TrainingStatus = "issued" | "signed" | "passed" | "failed";

interface TrainingRecord {
    id: number;
    applicant_id: number;
    user_id: number;
    status: TrainingStatus;
    start_date: string | null;
    end_date: string | null;
    pdf_file: string | null;
    signed_pdf_file: string | null;
    signed_at: string | null;
    remarks: string | null;
}

interface ApiEnvelope<T> {
    success: boolean;
    data?: T;
    message?: string;
}

const BASE = "/api/hrm/onboarding/pre-employment-training";
const GATE_URL = "/api/hrm/onboarding/hire-gate";
const RECOMMENDATION_URL = "/api/hrm/onboarding/employment-recommendation";

const WIZARD_STEPS = [
    { n: 1, label: "Path choice" },
    { n: 2, label: "Training letter" },
    { n: 3, label: "Sign letter" },
    { n: 4, label: "Training template" },
    { n: 5, label: "Training tasks" },
    { n: 6, label: "Fit or unfit" },
    { n: 7, label: "Recommendation" },
] as const;

type WizardStepState = "done" | "current" | "todo" | "skipped";

function trainingAssetUrl(pdfFile: string): string {
    return `/api/hrm/employee-admin/employee-master-list/assets/${pdfFile}?filename=${encodeURIComponent("Pre-Employment-Training.pdf")}`;
}

function todayInputValue(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function readErrorMessage(body: unknown, fallback: string): string {
    if (typeof body === "object" && body !== null) {
        const message = (body as { message?: unknown }).message;
        if (typeof message === "string" && message.trim()) return message;
    }
    return fallback;
}

async function uploadTrainingPdf(blob: Blob, fileName: string): Promise<string> {
    const payload = new FormData();
    payload.append("file", blob, fileName);
    const res = await fetch(`${BASE}/upload`, { method: "POST", body: payload });
    const body = (await res.json().catch(() => null)) as ApiEnvelope<{ id: string }> | null;
    if (!res.ok || !body?.success || !body.data?.id) {
        throw new Error(readErrorMessage(body, "Could not upload the training letter."));
    }
    return body.data.id;
}

export function PreEmploymentTrainingSection({ applicantId, userId, applicantStatus, prefill, trainingGroups, trainingLoading, trainingError, onTrainingRefresh }: PreEmploymentTrainingSectionProps) {
    const [record, setRecord] = React.useState<TrainingRecord | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);
    const [actionError, setActionError] = React.useState<string | null>(null);
    const [notice, setNotice] = React.useState<string | null>(null);
    const [decisionOutcome, setDecisionOutcome] = React.useState<string | null>(null);
    const [signable, setSignable] = React.useState<GeneratedTrainingLetter | null>(null);
    const [pdfError, setPdfError] = React.useState<string | null>(null);
    const [remarks, setRemarks] = React.useState("");
    const [confirmingFail, setConfirmingFail] = React.useState(false);
    const [gate, setGate] = React.useState<HireGateState | null>(null);
    const [gateLoading, setGateLoading] = React.useState(true);
    const [gateError, setGateError] = React.useState<string | null>(null);
    const [busyChoice, setBusyChoice] = React.useState<"employment" | "training" | null>(null);
    const [confirmingTemplate, setConfirmingTemplate] = React.useState(false);
    const [selectedTemplate, setSelectedTemplate] = React.useState<number | null>(null);
    const [assembled, setAssembled] = React.useState<EmploymentRecommendationAssembled | null>(null);
    const [assembledLoading, setAssembledLoading] = React.useState(false);
    const [assembledError, setAssembledError] = React.useState<string | null>(null);
    const signableUrlRef = React.useRef<string | null>(null);

    const fetchRecord = React.useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await fetch(`${BASE}?applicant_id=${applicantId}`, { cache: "no-store" });
            const body = (await res.json().catch(() => null)) as ApiEnvelope<TrainingRecord> | null;
            if (!res.ok || !body?.success) {
                throw new Error(readErrorMessage(body, "Could not load the training record."));
            }
            setRecord(body.data ?? null);
        } catch (err) {
            setLoadError(err instanceof Error ? err.message : "Could not load the training record.");
        } finally {
            setLoading(false);
        }
    }, [applicantId]);

    const fetchGate = React.useCallback(async () => {
        setGateLoading(true);
        setGateError(null);
        try {
            const res = await fetch(`${GATE_URL}?applicant_id=${applicantId}`, { cache: "no-store" });
            const body: unknown = await res.json().catch(() => null);
            const parsed = HireGateResponseSchema.safeParse(body);
            if (!res.ok || !parsed.success || !parsed.data.success || !parsed.data.data?.gate) {
                throw new Error(readErrorMessage(body, "Could not load the onboarding gate."));
            }
            setGate(parsed.data.data.gate);
        } catch (err) {
            setGate(null);
            setGateError(err instanceof Error ? err.message : "Could not load the onboarding gate.");
        } finally {
            setGateLoading(false);
        }
    }, [applicantId]);

    React.useEffect(() => {
        void fetchRecord();
    }, [fetchRecord]);

    React.useEffect(() => {
        void fetchGate();
    }, [fetchGate]);

    React.useEffect(() => {
        return () => {
            if (signableUrlRef.current) URL.revokeObjectURL(signableUrlRef.current);
        };
    }, []);

    const status = gate?.applicantStatus ?? applicantStatus ?? null;
    const hired = status === "hired";
    const hasRecord = record !== null;
    const trainingTaskCount = gate?.trainingTaskCount ?? 0;
    const hasTrainingTasks = trainingTaskCount > 0;
    const needsChoice = gate?.needsTrainingChoice ?? (status === "for_training" && !hasTrainingTasks && record?.status === "signed");
    const directHire = hired && !hasRecord;

    React.useEffect(() => {
        if (!hired) return;
        let cancelled = false;
        setAssembledLoading(true);
        setAssembledError(null);
        (async () => {
            try {
                const res = await fetch(`${RECOMMENDATION_URL}?user_id=${userId}&applicant_id=${applicantId}`, { cache: "no-store" });
                const body = (await res.json().catch(() => null)) as ApiEnvelope<EmploymentRecommendationAssembled> | null;
                if (cancelled) return;
                if (!res.ok || !body?.success || !body.data) {
                    throw new Error(readErrorMessage(body, "Could not assemble the recommendation letter."));
                }
                setAssembled(body.data);
            } catch (err) {
                if (!cancelled) {
                    setAssembled(null);
                    setAssembledError(err instanceof Error ? err.message : "Could not assemble the recommendation letter.");
                }
            } finally {
                if (!cancelled) setAssembledLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [hired, userId, applicantId]);

    React.useEffect(() => {
        let cancelled = false;
        setSignable(null);
        setPdfError(null);
        if (record?.status !== "issued" || !record.pdf_file) return;
        const fileId = record.pdf_file;
        (async () => {
            try {
                const res = await fetch(trainingAssetUrl(fileId), { cache: "no-store" });
                if (!res.ok) throw new Error("The issued letter could not be loaded for signing.");
                const blob = await res.blob();
                if (cancelled) return;
                const url = URL.createObjectURL(blob);
                if (signableUrlRef.current) URL.revokeObjectURL(signableUrlRef.current);
                signableUrlRef.current = url;
                setSignable({ blob, fileName: "Pre-Employment-Training.pdf", url });
            } catch (err) {
                if (!cancelled) {
                    setPdfError(err instanceof Error ? err.message : "The issued letter could not be loaded for signing.");
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [record?.status, record?.pdf_file]);

    const currentStep: number = hired
        ? 7
        : !hasRecord
          ? status === "signing_complete" ? 1 : status === "for_training" ? 2 : 1
          : record.status === "issued" ? 3
          : record.status === "signed" ? (needsChoice ? 4 : 5)
          : 6;

    const stepState = (n: number): WizardStepState => {
        if (directHire && n >= 2 && n <= 6) return "skipped";
        if (n < currentStep) return "done";
        if (n === currentStep) return "current";
        return "todo";
    };

    const runGateChoice = React.useCallback(
        async (choice: "employment" | "training", trainingTemplateId?: number) => {
            if (choice === "employment" || trainingTemplateId === undefined) {
                setBusyChoice(choice);
            } else {
                setConfirmingTemplate(true);
            }
            setActionError(null);
            setNotice(null);
            try {
                const res = await fetch(GATE_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        applicant_id: applicantId,
                        choice,
                        ...(trainingTemplateId !== undefined ? { training_template_id: trainingTemplateId } : {}),
                    }),
                });
                const body: unknown = await res.json().catch(() => null);
                const parsed = HireGateResponseSchema.safeParse(body);
                if (!res.ok || !parsed.success || !parsed.data.success || !parsed.data.data?.gate) {
                    throw new Error(readErrorMessage(body, "The onboarding gate request failed."));
                }
                setGate(parsed.data.data.gate);
                setSelectedTemplate(null);
                await fetchRecord();
                onTrainingRefresh?.();
            } catch (err) {
                setActionError(err instanceof Error ? err.message : "The onboarding gate request failed.");
            } finally {
                setBusyChoice(null);
                setConfirmingTemplate(false);
            }
        },
        [applicantId, fetchRecord, onTrainingRefresh]
    );

    const handleGenerated = React.useCallback(
        async (result: GeneratedTrainingLetter, fields?: PreEmploymentTrainingFormData) => {
            setBusy(true);
            setActionError(null);
            setNotice(null);
            try {
                const fileId = await uploadTrainingPdf(result.blob, result.fileName);
                const res = await fetch(BASE, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        applicant_id: applicantId,
                        user_id: userId,
                        pdf_file: fileId,
                        start_date: fields?.startDate || null,
                        end_date: fields?.endDate || null,
                        terms_snapshot: fields ?? null,
                        status: "issued",
                    }),
                });
                const body = (await res.json().catch(() => null)) as ApiEnvelope<unknown> | null;
                if (!res.ok || !body?.success) {
                    throw new Error(readErrorMessage(body, "Could not issue the training letter."));
                }
                await fetchRecord();
            } catch (err) {
                setActionError(err instanceof Error ? err.message : "Could not issue the training letter.");
            } finally {
                setBusy(false);
            }
        },
        [applicantId, fetchRecord, userId]
    );

    const handleSigned = React.useCallback(
        async (signed: SignedTrainingLetter) => {
            if (!record) return;
            setBusy(true);
            setActionError(null);
            setNotice(null);
            try {
                const fileId = await uploadTrainingPdf(signed.blob, signed.fileName);
                const res = await fetch(`${BASE}/${record.id}/sign`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ signed_pdf_file: fileId, file_name: signed.fileName }),
                });
                const body = (await res.json().catch(() => null)) as (ApiEnvelope<TrainingRecord> & { filed?: boolean }) | null;
                if (!res.ok || !body?.success) {
                    throw new Error(readErrorMessage(body, "Could not file the signed letter."));
                }
                if (body.filed === false) {
                    setNotice("Signed letter saved, but it was not filed to the 201 records. Please file it manually.");
                }
                await fetchRecord();
            } catch (err) {
                setActionError(err instanceof Error ? err.message : "Could not file the signed letter.");
            } finally {
                setBusy(false);
            }
        },
        [fetchRecord, record]
    );

    const handleDecision = React.useCallback(
        async (decision: "pass" | "fail") => {
            if (!record) return;
            setBusy(true);
            setActionError(null);
            setNotice(null);
            try {
                const res = await fetch(`${BASE}/${record.id}/decision`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(
                        decision === "fail" && remarks.trim()
                            ? { decision, remarks: remarks.trim() }
                            : { decision }
                    ),
                });
                const body = (await res.json().catch(() => null)) as ApiEnvelope<{ outcome?: string }> | null;
                if (!res.ok || !body?.success) {
                    throw new Error(readErrorMessage(body, "Could not record the decision."));
                }
                const outcome = body.data?.outcome;
                setDecisionOutcome(
                    decision === "pass"
                        ? "Marked passed — for employment."
                        : "Marked failed — not accepted."
                );
                if (typeof outcome === "string" && outcome.trim()) {
                    setDecisionOutcome((prev) => `${prev ?? ""} (${outcome.trim()})`.trim());
                }
                setConfirmingFail(false);
                await fetchRecord();
                await fetchGate();
                onTrainingRefresh?.();
            } catch (err) {
                setActionError(err instanceof Error ? err.message : "Could not record the decision.");
            } finally {
                setBusy(false);
            }
        },
        [fetchRecord, fetchGate, onTrainingRefresh, record, remarks]
    );

    const choosing = busyChoice !== null || confirmingTemplate;

    const renderStepIndicator = () => (
        <ol aria-label="Training wizard steps" className="flex flex-wrap items-center gap-1.5">
            {WIZARD_STEPS.map((step) => {
                const state = stepState(step.n);
                return (
                    <li key={step.n} className="flex items-center gap-1.5">
                        <span
                            aria-current={state === "current" ? "step" : undefined}
                            title={state === "skipped" ? `${step.label} — skipped for direct hires` : `${step.label} — ${state}`}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                                state === "done" && "border-primary/40 bg-primary/10 text-primary",
                                state === "current" && "border-primary bg-primary text-primary-foreground",
                                state === "todo" && "border-border text-muted-foreground",
                                state === "skipped" && "border-dashed border-border text-muted-foreground/70"
                            )}
                        >
                            <span aria-hidden="true">{state === "done" ? "✓" : state === "skipped" ? "–" : step.n}</span>
                            {step.label}
                        </span>
                    </li>
                );
            })}
        </ol>
    );

    const renderActionError = () => actionError ? (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
        </Alert>
    ) : null;

    const renderNotice = () => notice ? (
        <Alert>
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Heads up</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
        </Alert>
    ) : null;

    const renderPathChoice = () => (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <StatusBadge tone="info">Step 1 — choose the hire path</StatusBadge>
            </div>
            <p className="text-sm text-muted-foreground">
                Send this hiree for pre-employment training, or hire them for employment directly.
            </p>
            {renderActionError()}
            {gateError && !gate ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    <AlertTitle>Could not load the onboarding gate</AlertTitle>
                    <AlertDescription>{gateError}</AlertDescription>
                </Alert>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                    type="button"
                    className="w-full sm:w-auto"
                    disabled={choosing || gateLoading}
                    onClick={() => void runGateChoice("training")}
                    aria-label="Send applicant for training"
                >
                    {busyChoice === "training" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                        <GraduationCap className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    {busyChoice === "training" ? "Creating account…" : "For Training"}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={choosing || gateLoading}
                    onClick={() => void runGateChoice("employment")}
                    aria-label="Hire applicant for employment"
                >
                    {busyChoice === "employment" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                        <Briefcase className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    {busyChoice === "employment" ? "Creating account…" : "For Employment"}
                </Button>
            </div>
        </div>
    );

    const renderLetterForm = () => (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <StatusBadge tone="info">Step 2 — generate the training letter</StatusBadge>
            </div>
            <p className="text-sm text-muted-foreground">
                No training letter yet. Fill in the details below to issue one.
            </p>
            {renderActionError()}
            {busy ? (
                <Alert>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <AlertTitle>Issuing the training letter…</AlertTitle>
                    <AlertDescription>Uploading the letter and saving the record.</AlertDescription>
                </Alert>
            ) : null}
            <div className={busy ? "pointer-events-none opacity-60" : undefined} aria-busy={busy}>
                <PreEmploymentTrainingLetterForm prefill={prefill} onGenerated={(result, fields) => void handleGenerated(result, fields)} />
            </div>
        </div>
    );

    const renderSigning = () => (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <StatusBadge tone="warning">Step 3 — sign the issued letter</StatusBadge>
            </div>
            {renderActionError()}
            {renderNotice()}
            {pdfError ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    <AlertTitle>Letter unavailable for signing</AlertTitle>
                    <AlertDescription>{pdfError}</AlertDescription>
                </Alert>
            ) : signable ? (
                <div className={busy ? "pointer-events-none opacity-60" : undefined} aria-busy={busy}>
                    <PreEmploymentTrainingLetterSign
                        letter={signable}
                        filingKey={`pre-employment-training-${applicantId}`}
                        onSigned={(signed) => void handleSigned(signed)}
                    />
                </div>
            ) : (
                <div className="grid gap-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            )}
            {busy ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Filing the signed letter…
                </p>
            ) : null}
        </div>
    );

    const renderTemplatePicker = () => (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <StatusBadge tone="info">Step 4 — pick a training template</StatusBadge>
            </div>
            <p className="text-sm text-muted-foreground">
                The signed letter is on file. Choose which training this hiree will take.
            </p>
            {renderActionError()}
            {renderNotice()}
            {gateLoading ? (
                <div className="grid gap-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ) : !gate || gate.templates.length === 0 ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    <AlertTitle>No training template available</AlertTitle>
                    <AlertDescription>
                        {gateError ?? "No active training template applies to this hire's department yet — add one in the training catalog, then retry."}
                    </AlertDescription>
                </Alert>
            ) : (
                <>
                    <ul className="grid gap-2">
                        {gate.templates.map((template) => {
                            const active = selectedTemplate === template.id;
                            return (
                                <li key={template.id}>
                                    <button
                                        type="button"
                                        aria-pressed={active}
                                        disabled={choosing}
                                        onClick={() => setSelectedTemplate(template.id)}
                                        className={cn(
                                            "w-full rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                                            active
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:border-primary/50"
                                        )}
                                    >
                                        <span className="flex items-center justify-between gap-2">
                                            <span className="truncate text-sm font-medium" title={template.title}>
                                                {template.title}
                                            </span>
                                            <span className="inline-flex shrink-0 items-center rounded-md border border-border px-1.5 py-0.5 text-xs font-medium text-foreground">
                                                {template.global ? "Global" : "Department"}
                                            </span>
                                        </span>
                                        <span className="mt-1 block text-xs text-muted-foreground">
                                            {template.itemCount} item{template.itemCount === 1 ? "" : "s"} ·{" "}
                                            {template.requiredItemCount} required
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button
                            type="button"
                            className="w-full sm:w-auto"
                            disabled={selectedTemplate === null || choosing}
                            onClick={() => selectedTemplate !== null && void runGateChoice("training", selectedTemplate)}
                        >
                            {confirmingTemplate ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
                            )}
                            {confirmingTemplate ? "Assigning…" : "Assign selected training"}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full sm:w-auto"
                            disabled={choosing}
                            onClick={() => void fetchGate()}
                        >
                            Refresh templates
                        </Button>
                    </div>
                </>
            )}
        </div>
    );

    const renderTrainingTasks = () => (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <StatusBadge tone="info">Step 5 — training tasks</StatusBadge>
            </div>
            {trainingGroups === undefined ? (
                <p className="text-sm text-muted-foreground">
                    The training checklist for this hire lives in the Training tab above.
                </p>
            ) : (
                <TrainingTab
                    groups={trainingGroups}
                    loading={trainingLoading ?? false}
                    error={trainingError ?? null}
                    onRefresh={() => onTrainingRefresh?.()}
                />
            )}
        </div>
    );

    const renderDecision = () => (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <StatusBadge tone="info">Step 6 — fit or unfit</StatusBadge>
            </div>
            {decisionOutcome ? (
                <Alert>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <AlertTitle>Recorded</AlertTitle>
                    <AlertDescription>{decisionOutcome}</AlertDescription>
                </Alert>
            ) : null}
            {renderActionError()}
            {renderNotice()}
            <Card className="shadow-none">
                <CardHeader>
                    <CardTitle>Training decision</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        The signed letter is on file. Pass this trainee for employment, or fail them.
                    </p>
                    {confirmingFail ? (
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <Label htmlFor="pet-fail-remarks">Reason for failing (optional)</Label>
                                <Textarea
                                    id="pet-fail-remarks"
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder="Brief reason, e.g. did not complete the required training days"
                                    rows={4}
                                    disabled={busy}
                                />
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                    type="button"
                                    variant="destructive"
                                    disabled={busy}
                                    onClick={() => void handleDecision("fail")}
                                >
                                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                                    Confirm fail
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => setConfirmingFail(false)}
                                >
                                    Back
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button type="button" disabled={busy} onClick={() => void handleDecision("pass")}>
                                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                                Pass — for employment
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                disabled={busy}
                                onClick={() => setConfirmingFail(true)}
                            >
                                Fail — not accepted
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );

    const renderSettled = () => {
        if (!record) return null;
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    {record.status === "passed" ? (
                        <StatusBadge tone="success">Passed — for employment</StatusBadge>
                    ) : (
                        <StatusBadge tone="destructive">Failed — not accepted</StatusBadge>
                    )}
                </div>
                {decisionOutcome ? (
                    <Alert>
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        <AlertTitle>Recorded</AlertTitle>
                        <AlertDescription>{decisionOutcome}</AlertDescription>
                    </Alert>
                ) : null}
                <Card className="shadow-none">
                    <CardContent className="space-y-2 pt-6">
                        <p className="flex items-center gap-2 text-sm">
                            {record.status === "passed" ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
                            ) : (
                                <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
                            )}
                            {record.status === "passed"
                                ? "This trainee passed pre-employment training."
                                : "This trainee was not accepted after pre-employment training."}
                        </p>
                        {record.remarks ? (
                            <p className="text-sm text-muted-foreground">Reason: {record.remarks}</p>
                        ) : null}
                        {record.signed_at ? (
                            <p className="text-xs text-muted-foreground">Signed on {record.signed_at}</p>
                        ) : null}
                    </CardContent>
                </Card>
            </div>
        );
    };

    const renderRecommendation = () => (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <StatusBadge tone="success">Step 7 — recommendation for employment</StatusBadge>
            </div>
            {assembledLoading ? (
                <div className="grid gap-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            ) : assembledError || !assembled ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    <AlertTitle>Could not assemble the recommendation</AlertTitle>
                    <AlertDescription>{assembledError ?? "The recommendation details are unavailable."}</AlertDescription>
                </Alert>
            ) : (
                <EmploymentRecommendationStep
                    userId={userId}
                    applicantId={applicantId}
                    effectivityDate={todayInputValue()}
                    assembled={assembled}
                />
            )}
        </div>
    );

    if (loading) {
        return (
            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Pre-employment training</h2>
                {renderStepIndicator()}
                <div className="grid gap-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Pre-employment training</h2>
                {renderStepIndicator()}
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    <AlertTitle>Could not load training</AlertTitle>
                    <AlertDescription>{loadError}</AlertDescription>
                </Alert>
                <Button type="button" variant="outline" onClick={() => void fetchRecord()}>
                    Try again
                </Button>
            </div>
        );
    }

    if (!hasRecord) {
        if (hired) {
            return (
                <div className="space-y-6">
                    <h2 className="text-lg font-semibold">Pre-employment training</h2>
                    {renderStepIndicator()}
                    <p className="text-sm text-muted-foreground">
                        Hired directly for employment — the training steps were skipped.
                    </p>
                    {renderRecommendation()}
                </div>
            );
        }
        if (status === "signing_complete") {
            return (
                <div className="space-y-6">
                    <h2 className="text-lg font-semibold">Pre-employment training</h2>
                    {renderStepIndicator()}
                    {renderPathChoice()}
                </div>
            );
        }
        if (status === "for_training") {
            return (
                <div className="space-y-6">
                    <h2 className="text-lg font-semibold">Pre-employment training</h2>
                    {renderStepIndicator()}
                    {renderLetterForm()}
                </div>
            );
        }
        return (
            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Pre-employment training</h2>
                {renderStepIndicator()}
                <p className="text-sm text-muted-foreground">
                    Pre-employment training does not apply at this stage.
                </p>
            </div>
        );
    }

    if (record.status === "issued") {
        return (
            <div className="space-y-6">
                <h2 className="text-lg font-semibold">Pre-employment training</h2>
                {renderStepIndicator()}
                {renderSigning()}
            </div>
        );
    }

    if (record.status === "signed") {
        if (needsChoice) {
            return (
                <div className="space-y-6">
                    <h2 className="text-lg font-semibold">Pre-employment training</h2>
                    {renderStepIndicator()}
                    {renderTemplatePicker()}
                </div>
            );
        }
        return (
            <div className="space-y-6">
                <h2 className="text-lg font-semibold">Pre-employment training</h2>
                {renderStepIndicator()}
                {renderTrainingTasks()}
                {renderDecision()}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-lg font-semibold">Pre-employment training</h2>
            {renderStepIndicator()}
            {renderSettled()}
            {hired ? renderRecommendation() : null}
        </div>
    );
}

export default PreEmploymentTrainingSection;
