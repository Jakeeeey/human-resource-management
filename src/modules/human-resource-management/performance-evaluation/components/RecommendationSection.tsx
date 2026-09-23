"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Award, FileCheck, Stamp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

import type {
    WorkspaceBundle,
} from "../types/performance-evaluation.schema";
import {
    EvaluationClientError,
    issueRecommendation,
    regularize,
    type EvaluationScope,
} from "../providers/evaluationClient";
import { deriveNextAction, deriveStage } from "../utils/workflow";
import { todayPH } from "../utils/probationClock";
import { buildRecommendationLetterPdf } from "../utils/recommendationPdf";
import { buildWorkflowFacts, workflowStageLabel } from "./OverviewSection";
import { RecommendationLetterPreviewModal } from "./RecommendationLetterPreviewModal";

interface CompanyLogo {
    id: number;
    company_name: string;
    logo_data_url: string | null;
    is_default: boolean;
}

function errorMessage(err: unknown, fallback: string): string {
    if (err instanceof EvaluationClientError) return err.message;
    return fallback;
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
    const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
    const [companyName, setCompanyName] = useState("");
    const [issuing, setIssuing] = useState(false);
    const [regularizing, setRegularizing] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const res = await fetch("/api/hrm/company-logos");
                if (!res.ok) return;
                const json = await res.json().catch(() => null);
                if (cancelled || !Array.isArray(json?.data)) return;
                const rows = json.data as CompanyLogo[];
                const preferred = rows.find((row) => row.is_default) ?? rows[0];
                if (!preferred) return;
                setLogoDataUrl(preferred.logo_data_url);
                setCompanyName(preferred.company_name);
            } catch {
                if (!cancelled) setLogoDataUrl(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const facts = buildWorkflowFacts(bundle);
    const stage = deriveStage(facts);
    const nextAction = deriveNextAction(facts);
    const recommendationIssued = bundle.tracking?.recommendation_issued_at !== null &&
        bundle.tracking?.recommendation_issued_at !== undefined;
    const alreadyRegular = bundle.tracking?.regularized_at !== null &&
        bundle.tracking?.regularized_at !== undefined;

    const isHr = scope === "hr";
    const readyToRecommend = nextAction?.key === "recommendation";
    const canIssue = isHr && readyToRecommend && !recommendationIssued && !issuing;
    const canRegularize = isHr && recommendationIssued && !alreadyRegular && !regularizing;

    const employee = bundle.employee;
    const employeeName = employee.full_name.trim() ? employee.full_name : `Employee #${userId}`;
    const fileName = `Recommendation-Letter-${employeeName.trim().replace(/\s+/g, "-")}.pdf`;

    const handleIssue = async () => {
        setIssuing(true);
        try {
            await issueRecommendation(userId);
            const blob = buildRecommendationLetterPdf(
                {
                    employeeName,
                    position: employee.position ?? "",
                    department: employee.department_name ?? "",
                    letterDate: todayPH(),
                    companyName,
                    headerAddress: "",
                    headerContact: "",
                    headerEmail: "",
                    signatoryName: "",
                    signatoryTitle: "",
                },
                logoDataUrl
            );
            setPreviewUrl((previous) => {
                if (previous) URL.revokeObjectURL(previous);
                return URL.createObjectURL(blob);
            });
            setPreviewOpen(true);
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
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <FileCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                            Recommendation letter
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            {recommendationIssued ? (
                                <StatusBadge tone="success">Issued</StatusBadge>
                            ) : (
                                <StatusBadge tone="neutral">Not issued</StatusBadge>
                            )}
                            {bundle.tracking?.recommendation_issued_at ? (
                                <span className="text-sm text-muted-foreground">
                                    {bundle.tracking.recommendation_issued_at}
                                </span>
                            ) : null}
                        </div>
                        {isHr ? (
                            <div className="space-y-2">
                                <Button
                                    onClick={() => void handleIssue()}
                                    disabled={!canIssue}
                                    className="w-full sm:w-auto"
                                >
                                    <Award className="mr-2 h-4 w-4" aria-hidden="true" />
                                    {issuing ? "Saving…" : "Issue recommendation letter"}
                                </Button>
                                {!recommendationIssued && !readyToRecommend ? (
                                    <p className="text-sm text-muted-foreground">
                                        Current stage: {workflowStageLabel(stage)}
                                        {nextAction ? ` — ${nextAction.label} first.` : "."}
                                    </p>
                                ) : null}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Recommendation letters are issued by HR.
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Stamp className="h-4 w-4 text-primary" aria-hidden="true" />
                            Regularization
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            {alreadyRegular ? (
                                <StatusBadge tone="success">Regular</StatusBadge>
                            ) : (
                                <StatusBadge tone="neutral">Probationary</StatusBadge>
                            )}
                            {bundle.tracking?.regularized_at ? (
                                <span className="text-sm text-muted-foreground">
                                    {bundle.tracking.regularized_at}
                                </span>
                            ) : null}
                        </div>
                        {isHr ? (
                            <div className="space-y-2">
                                <Button
                                    onClick={() => void handleRegularize()}
                                    disabled={!canRegularize}
                                    variant="outline"
                                    className="w-full sm:w-auto"
                                >
                                    {regularizing ? "Saving…" : "Regularize"}
                                </Button>
                                {!alreadyRegular && !recommendationIssued ? (
                                    <p className="text-sm text-muted-foreground">
                                        Current stage: {workflowStageLabel(stage)} — issue the
                                        recommendation letter first.
                                    </p>
                                ) : null}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Final approval is recorded by HR.
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
