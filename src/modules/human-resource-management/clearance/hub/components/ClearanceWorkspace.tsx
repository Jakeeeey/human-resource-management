"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

import { useClearanceHubContext } from "../providers/ClearanceHubProvider";
import type { ClearanceHubRequest } from "../hooks/useClearanceHub";
import {
    CLEARANCE_REQUEST_STATUS_LABELS,
    type ClearanceRequestStatus,
} from "../types";
import { formatPHT } from "../utils/time";
import { useDocumentChecklist } from "../hooks/useDocumentChecklist";
import { DocumentChecklist } from "./DocumentChecklist";
import styles from "./hub-status.module.css";

function statusTone(status: ClearanceRequestStatus): StatusTone {
    if (status === "completed") return "success";
    if (status === "in_progress") return "info";
    return "neutral";
}

function WorkspaceSkeletons() {
    return (
        <div className="space-y-6" aria-label="Loading workspace">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
        </div>
    );
}

export function ClearanceWorkspace({ requestId }: { requestId: number }) {
    const {
        resignations,
        refresh,
        fetchDetail,
    } = useClearanceHubContext();

    const [detail, setDetail] = useState<ClearanceHubRequest | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const documents = useDocumentChecklist(requestId, detail?.user_id ?? null);

    const reloadDetail = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const loaded = await fetchDetail(requestId);
            setDetail(loaded);
        } catch (err) {
            setDetail(null);
            setError(err instanceof Error ? err.message : "Failed to load clearance request");
        } finally {
            setIsLoading(false);
        }
    }, [requestId, fetchDetail]);

    useEffect(() => {
        void reloadDetail();
    }, [reloadDetail]);

    const employeeName = useMemo(() => {
        if (!detail) return "Unknown employee";
        const resignation = resignations.find((entry) => entry.id === detail.resignation_id);
        return resignation ? resignation.employee_name : "Unknown employee";
    }, [detail, resignations]);

    const templateTitle = detail?.template_title_snapshot ?? "Unknown template";

    const handleRefresh = async () => {
        await reloadDetail();
        await documents.refresh();
        await refresh();
    };

    const isCompleted = detail?.status === "completed";

    return (
        <div className="mx-auto min-h-screen max-w-[1600px] space-y-6 p-2 sm:p-6 md:p-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                    <div className="shrink-0 rounded-2xl bg-primary/10 p-3">
                        <ClipboardCheck className="h-6 w-6 text-primary" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="line-clamp-2 text-2xl font-bold sm:text-4xl" title={employeeName}>
                                {isLoading && !detail ? "Loading…" : employeeName}
                            </h1>
                            {detail ? (
                                <StatusBadge tone={statusTone(detail.status)} className={detail.status === "completed" ? styles.signed : styles.pending}>
                                    {CLEARANCE_REQUEST_STATUS_LABELS[detail.status]}
                                </StatusBadge>
                            ) : null}
                        </div>
                        <p className="text-base text-muted-foreground sm:text-lg">
                            Resignation clearance workspace
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 gap-2">
                    <Button asChild variant="outline" size="sm" className="min-h-11 w-full sm:w-auto md:min-h-0">
                        <Link href={`/hrm/clearance/hub?selected=${requestId}`}>Back to hub</Link>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11 w-full sm:w-auto md:min-h-0"
                        onClick={() => void handleRefresh()}
                        disabled={isLoading}
                        aria-label="Refresh workspace"
                        title="Refresh workspace"
                    >
                        <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                        Refresh
                    </Button>
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
                <div className="space-y-6">
                    <Card>
                        <CardContent className="flex flex-col gap-4 p-4 sm:p-6 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0 flex-1 space-y-1">
                                <h2 className="text-xl font-semibold sm:text-2xl">
                                    {templateTitle}
                                </h2>
                                <dl className="space-y-1 pt-2 text-sm">
                                    <div className="flex items-center justify-between gap-2">
                                        <dt className="text-muted-foreground">Filed</dt>
                                        <dd className="font-medium tabular-nums">{formatPHT(detail.created_at)}</dd>
                                    </div>
                                </dl>
                            </div>
                        </CardContent>
                    </Card>

                    <DocumentChecklist
                        checklist={documents.checklist}
                        isLoading={documents.isLoading}
                        error={documents.error}
                        onRetry={() => void documents.refresh()}
                    />

                    {isCompleted ? (
                        <Alert>
                            <AlertDescription>
                                This clearance is completed and read-only. Corrections are handled on paper.
                            </AlertDescription>
                        </Alert>
                    ) : null}
                </div>
            )}
        </div>
    );
}
