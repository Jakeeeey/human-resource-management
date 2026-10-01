"use client";

import { useEffect, useState } from "react";
import type { JSX } from "react";
import { toast } from "sonner";
import { Award, CheckCircle2, Eye, FileCheck, Stamp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import type {
    WorkspaceBundle,
} from "../types/performance-evaluation.schema";
import {
    EvaluationClientError,
    getDepartmentSuperiors,
    issueRecommendation,
    regularize,
    setEmployeeCompany,
    type EvaluationScope,
} from "../providers/evaluationClient";
import { deriveNextAction, deriveStage } from "../utils/workflow";
import { todayPH } from "../utils/probationClock";
import {
    buildRecommendationLetterPdf,
    formatRecommendationCompanyAddress,
} from "../utils/recommendationPdf";
import { buildWorkflowFacts, workflowStageLabel } from "./OverviewSection";
import { RecommendationLetterPreviewModal } from "./RecommendationLetterPreviewModal";

interface CompanyOption {
    id: number;
    company_name: string;
}

function errorMessage(err: unknown, fallback: string): string {
    if (err instanceof EvaluationClientError) return err.message;
    return fallback;
}

const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

function formatDay(value: string | null | undefined): string {
    if (!value) return "—";
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return value;
    const [, year, month, day] = match;
    return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`;
}

function formatStamp(value: string | null | undefined): string {
    if (!value) return "—";
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (!match) return formatDay(value);
    const [, year, month, day, hourRaw, minute] = match;
    const hour = Number(hourRaw);
    const suffix = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}, ${hour12}:${minute} ${suffix}`;
}

function StepMarker({ state, step }: { state: "done" | "active" | "upcoming"; step: number }): JSX.Element {
    if (state === "done") {
        return (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            </span>
        );
    }
    if (state === "active") {
        return (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground tabular-nums">
                {step}
            </span>
        );
    }
    return (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold text-muted-foreground tabular-nums">
            {step}
        </span>
    );
}

function EmployeeCompanyPicker({
    userId,
    onRefresh,
}: {
    userId: number;
    onRefresh: () => void;
}) {
    const [options, setOptions] = useState<CompanyOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [selected, setSelected] = useState("");
    const [saving, setSaving] = useState(false);

    const loadOptions = async () => {
        setLoading(true);
        setLoadFailed(false);
        try {
            const res = await fetch("/api/hrm/recruitment/job-offer/company-logos", { cache: "no-store" });
            if (!res.ok) {
                setLoadFailed(true);
                return;
            }
            const json = await res.json().catch(() => null);
            if (!Array.isArray(json?.data)) {
                setLoadFailed(true);
                return;
            }
            const rows: CompanyOption[] = [];
            for (const entry of json.data as unknown[]) {
                if (typeof entry !== "object" || entry === null) continue;
                const record = entry as { id?: unknown; company_name?: unknown };
                const id = Number(record.id);
                const name = typeof record.company_name === "string" ? record.company_name : "";
                if (!Number.isInteger(id) || id <= 0 || name.trim() === "") continue;
                rows.push({ id, company_name: name });
            }
            setOptions(rows);
        } catch {
            setLoadFailed(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadOptions();
    }, []);

    const handleSave = async () => {
        const companyId = Number(selected);
        if (!Number.isInteger(companyId) || companyId <= 0 || saving) return;
        setSaving(true);
        try {
            await setEmployeeCompany(userId, companyId);
            toast.success("Company set");
            onRefresh();
        } catch (err) {
            toast.error(errorMessage(err, "Failed to set the company."));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Set employee company</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                    No company is on record for this employee. Pick the company so the
                    recommendation letter uses the right letterhead.
                </p>
                <div className="space-y-2">
                    <Label htmlFor="employee-company-select">Company</Label>
                    <Select value={selected} onValueChange={setSelected} disabled={loading || saving}>
                        <SelectTrigger id="employee-company-select" className="w-full sm:w-80">
                            <SelectValue
                                placeholder={loading ? "Loading companies…" : "Select a company"}
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {options.map((option) => (
                                <SelectItem key={option.id} value={String(option.id)}>
                                    {option.company_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {loadFailed ? (
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm text-muted-foreground">Failed to load companies.</p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void loadOptions()}
                            disabled={loading || saving}
                        >
                            Retry
                        </Button>
                    </div>
                ) : null}
                <Button
                    onClick={() => void handleSave()}
                    disabled={selected.trim() === "" || loading || saving}
                    className="w-full sm:w-auto"
                >
                    {saving ? "Saving…" : "Set company"}
                </Button>
            </CardContent>
        </Card>
    );
}

export function RecommendationSection({
    scope,
    userId,
    bundle,
    onRefresh,
}: {
    scope: EvaluationScope;
    userId: number;
    bundle: WorkspaceBundle;
    onRefresh: () => void;
}) {
    const [signatoryName, setSignatoryName] = useState("");
    const [signatoryTitle, setSignatoryTitle] = useState("");
    const [issuing, setIssuing] = useState(false);
    const [regularizing, setRegularizing] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const superiors = await getDepartmentSuperiors(userId);
                if (cancelled) return;
                const head = superiors.find((entry) => entry.is_department_head);
                if (!head) return;
                setSignatoryName(head.full_name);
                setSignatoryTitle(head.position ?? "");
            } catch {
                return;
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [userId]);

    const facts = buildWorkflowFacts(bundle);
    const stage = deriveStage(facts);
    const nextAction = deriveNextAction(facts);
    const recommendationIssued = bundle.tracking?.recommendation_issued_at !== null &&
        bundle.tracking?.recommendation_issued_at !== undefined;
    const alreadyRegular = bundle.tracking?.regularized_at !== null &&
        bundle.tracking?.regularized_at !== undefined;

    const isHr = scope === "hr";
    const company = bundle.company;
    const companyName = company?.company_name ?? "";
    const headerAddress = company ? formatRecommendationCompanyAddress(company) : "";
    const headerContact = company?.company_contact ?? "";
    const headerEmail = company?.company_email ?? "";
    const logoDataUrl = company?.logo_data_url ?? null;
    const needsCompany = bundle.employee.company_id === null || bundle.employee.company_id === undefined;
    const readyToRecommend = nextAction?.key === "recommendation";
    const canIssue = isHr && readyToRecommend && !recommendationIssued && !issuing;
    const canRegularize = isHr && recommendationIssued && !alreadyRegular && !regularizing;

    const issueStepState = recommendationIssued ? "done" : readyToRecommend ? "active" : "upcoming";
    const regularizeStepState = alreadyRegular
        ? "done"
        : recommendationIssued
            ? "active"
            : "upcoming";

    const employee = bundle.employee;
    const employeeName = employee.full_name.trim() ? employee.full_name : `Employee #${userId}`;
    const fileName = `Recommendation-Letter-${employeeName.trim().replace(/\s+/g, "-")}.pdf`;

    const openLetterPreview = () => {
        const blob = buildRecommendationLetterPdf(
            {
                employeeName,
                position: employee.position ?? "",
                department: employee.department_name ?? "",
                letterDate: todayPH(),
                companyName,
                headerAddress,
                headerContact,
                headerEmail,
                signatoryName,
                signatoryTitle,
            },
            logoDataUrl
        );
        setPreviewUrl((previous) => {
            if (previous) URL.revokeObjectURL(previous);
            return URL.createObjectURL(blob);
        });
        setPreviewOpen(true);
    };

    const handleIssue = async () => {
        setIssuing(true);
        try {
            await issueRecommendation(userId);
            openLetterPreview();
            toast.success("Recommendation letter issued");
            onRefresh();
        } catch (err) {
            toast.error(errorMessage(err, "Failed to issue the recommendation letter."));
        } finally {
            setIssuing(false);
        }
    };

    const handlePreviewChange = (open: boolean) => {
        if (!open) {
            setPreviewUrl((previous) => {
                if (previous) URL.revokeObjectURL(previous);
                return null;
            });
        }
        setPreviewOpen(open);
    };

    const handleRegularize = async () => {
        setRegularizing(true);
        try {
            await regularize(userId);
            toast.success("Employee regularized");
            onRefresh();
        } catch (err) {
            toast.error(errorMessage(err, "Failed to regularize this employee."));
        } finally {
            setRegularizing(false);
        }
    };

    return (
        <div className="space-y-4">
            {isHr && needsCompany ? (
                <EmployeeCompanyPicker userId={userId} onRefresh={onRefresh} />
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <StepMarker state={issueStepState} step={1} />
                            <FileCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                            Issue recommendation letter
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {recommendationIssued ? (
                            <div className="space-y-1 rounded-[var(--radius)] border bg-muted/40 px-4 py-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <StatusBadge tone="success">
                                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                        Issued
                                    </StatusBadge>
                                    {bundle.tracking?.recommendation_issued_at ? (
                                        <span className="text-sm font-medium tabular-nums">
                                            {formatStamp(bundle.tracking.recommendation_issued_at)}
                                        </span>
                                    ) : null}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Step 1 of 2 complete. The letter can move to final approval.
                                </p>
                                {isHr ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={openLetterPreview}
                                        className="mt-2"
                                    >
                                        <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                                        View letter
                                    </Button>
                                ) : null}
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge tone="neutral">Not issued</StatusBadge>
                                <span className="text-xs text-muted-foreground">Step 1 of 2</span>
                            </div>
                        )}
                        {isHr ? (
                            recommendationIssued ? null : (
                                <div className="space-y-2">
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            onClick={() => void handleIssue()}
                                            disabled={!canIssue}
                                            aria-describedby="issue-gating"
                                            className="w-full sm:w-auto"
                                        >
                                            <Award className="mr-2 h-4 w-4" aria-hidden="true" />
                                            {issuing ? "Saving…" : "Issue recommendation letter"}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={openLetterPreview}
                                            disabled={issuing}
                                            className="w-full sm:w-auto"
                                        >
                                            <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                                            Preview letter
                                        </Button>
                                    </div>
                                    {!readyToRecommend ? (
                                        <p id="issue-gating" className="text-sm text-muted-foreground">
                                            Current stage: {workflowStageLabel(stage)}
                                            {nextAction ? ` — ${nextAction.label} first.` : " — finish the current stage first."}
                                        </p>
                                    ) : null}
                                </div>
                            )
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Only HR can issue the recommendation letter. Current stage:{" "}
                                {workflowStageLabel(stage)}.
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <StepMarker state={regularizeStepState} step={2} />
                            <Stamp className="h-4 w-4 text-primary" aria-hidden="true" />
                            Regularize
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {alreadyRegular ? (
                            <div className="space-y-1 rounded-[var(--radius)] border bg-muted/40 px-4 py-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <StatusBadge tone="success">
                                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                        Regular
                                    </StatusBadge>
                                    {bundle.tracking?.regularized_at ? (
                                        <span className="text-sm font-medium tabular-nums">
                                            {formatStamp(bundle.tracking.regularized_at)}
                                        </span>
                                    ) : null}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Step 2 of 2 complete. This employee is regular.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge tone="info">For regularization</StatusBadge>
                                <span className="text-xs text-muted-foreground">Step 2 of 2 · final approval</span>
                            </div>
                        )}
                        {isHr ? (
                            alreadyRegular ? null : (
                                <div className="space-y-2">
                                    <Button
                                        onClick={() => void handleRegularize()}
                                        disabled={!canRegularize}
                                        aria-describedby="regularize-gating"
                                        variant="outline"
                                        className="w-full sm:w-auto"
                                    >
                                        {regularizing ? "Saving…" : "Regularize"}
                                    </Button>
                                    {!recommendationIssued ? (
                                        <p id="regularize-gating" className="text-sm text-muted-foreground">
                                            Current stage: {workflowStageLabel(stage)} — issue the
                                            recommendation letter first.
                                        </p>
                                    ) : null}
                                </div>
                            )
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Final approval is recorded by HR. Current stage:{" "}
                                {workflowStageLabel(stage)}.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <RecommendationLetterPreviewModal
                isOpen={previewOpen}
                onOpenChange={handlePreviewChange}
                pdfUrl={previewUrl}
                fileName={fileName}
            />
        </div>
    );
}
