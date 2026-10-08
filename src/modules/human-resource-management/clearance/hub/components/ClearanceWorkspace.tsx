"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import type { JSX } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ClipboardCheck, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useClearanceHubContext } from "../providers/ClearanceHubProvider";
import type { ClearanceHubRequest } from "../hooks/useClearanceHub";
import {
    CLEARANCE_REQUEST_STATUS_LABELS,
    type ClearanceRequestStatus,
} from "../types";
import { formatPHT } from "../utils/time";
import { useDocumentChecklist } from "../hooks/useDocumentChecklist";
import { DocumentChecklist } from "./DocumentChecklist";
import ClearanceFormModule from "../form";
import ClearanceSoaModule from "../soa";
import ClearanceQuitClaimsModule from "../quit-claims";
import { parseClearanceHubTab } from "../utils/documentTabs";
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

function ClearanceWorkspaceInner({ requestId }: { requestId: number }): JSX.Element {
    const {
        resignations,
        refresh,
        fetchDetail,
        isLoading: hubLoading,
    } = useClearanceHubContext();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const tab = parseClearanceHubTab(searchParams.get("tab"));

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

    const resignationMatch = detail
        ? resignations.find((entry) => entry.id === detail.resignation_id) ?? null
        : null;
    const employeeName = !detail
        ? ""
        : (resignationMatch ? resignationMatch.employee_name : "Unknown employee");
    const nameLoading = detail !== null && resignationMatch === null && hubLoading;

    const handleRefresh = async () => {
        await reloadDetail();
        await documents.refresh();
        await refresh();
    };

    function handleTabChange(next: string): void {
        const parsed = parseClearanceHubTab(next);
        const params = new URLSearchParams(searchParams.toString());
        params.set("request", String(requestId));
        if (parsed === "overview") {
            params.delete("tab");
        } else {
            params.set("tab", parsed);
        }
        params.delete("print");
        const query = params.toString();
        router.replace(query === "" ? pathname : `${pathname}?${query}`, { scroll: false });
    }

    const isCompleted = detail?.status === "completed";
    const approvedCount = documents.checklist?.approvedCount ?? 0;
    const filedLabel = formatPHT(detail?.created_at);
    const confirmedLabel = formatPHT(detail?.confirmed_at);
    const progressLabel = `${approvedCount} of 3 approved`;
    const progressValue = Math.round((approvedCount / 3) * 100);

    return (
        <div className="mx-auto min-h-screen max-w-[1600px] space-y-6 p-2 sm:p-6 md:p-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                    <div className="shrink-0 rounded-2xl bg-primary/10 p-3">
                        <ClipboardCheck className="h-6 w-6 text-primary" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            {detail && nameLoading ? (
                                <Skeleton className="h-9 w-56" aria-label="Loading employee name" />
                            ) : (
                                <h1 className="line-clamp-2 text-2xl font-bold sm:text-4xl" title={employeeName}>
                                    {isLoading && !detail ? "Loading…" : employeeName}
                                </h1>
                            )}
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
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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

            <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
                <TabsList className="group-data-[orientation=horizontal]/tabs:h-auto w-fit max-w-full flex-wrap justify-start gap-1">
                    <TabsTrigger value="overview" className="min-h-11 shrink-0 md:min-h-0 text-base data-[state=active]:bg-primary data-[state=active]:font-semibold data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:border-transparent dark:data-[state=active]:text-primary-foreground">Overview</TabsTrigger>
                    <TabsTrigger value="form" className="min-h-11 shrink-0 md:min-h-0 text-base data-[state=active]:bg-primary data-[state=active]:font-semibold data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:border-transparent dark:data-[state=active]:text-primary-foreground">Clearance Form</TabsTrigger>
                    <TabsTrigger value="soa" className="min-h-11 shrink-0 md:min-h-0 text-base data-[state=active]:bg-primary data-[state=active]:font-semibold data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:border-transparent dark:data-[state=active]:text-primary-foreground">SOA</TabsTrigger>
                    <TabsTrigger value="quit-claims" className="min-h-11 shrink-0 md:min-h-0 text-base data-[state=active]:bg-primary data-[state=active]:font-semibold data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:border-transparent dark:data-[state=active]:text-primary-foreground">Quit Claims</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="m-0">
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
                                <CardHeader className="px-4 sm:px-6">
                                    <CardTitle className="font-mono text-lg font-semibold tracking-tight">Clearance Request</CardTitle>
                                </CardHeader>
                                <CardContent className="px-4 sm:px-6">
                                    <div className="w-full space-y-3">
                                        <dl className="w-full space-y-2 text-sm">
                                            <div className="flex items-center justify-between gap-4">
                                                <dt className="shrink-0 text-muted-foreground">Filed</dt>
                                                <dd className="min-w-0 truncate text-right font-medium tabular-nums" title={filedLabel}>{filedLabel}</dd>
                                            </div>
                                            <div className="flex items-center justify-between gap-4">
                                                <dt className="shrink-0 text-muted-foreground">Confirmed</dt>
                                                <dd className="min-w-0 truncate text-right font-medium tabular-nums" title={confirmedLabel}>{confirmedLabel}</dd>
                                            </div>
                                            <div className="flex items-center justify-between gap-4">
                                                <dt className="shrink-0 text-muted-foreground">Progress</dt>
                                                <dd className="min-w-0 truncate text-right font-medium tabular-nums" title={progressLabel}>
                                                    {progressLabel}
                                                </dd>
                                            </div>
                                        </dl>
                                        <Progress
                                            value={progressValue}
                                            className="w-full"
                                            aria-label={progressLabel}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <DocumentChecklist
                                checklist={documents.checklist}
                                isLoading={documents.isLoading}
                                error={documents.error}
                                onRetry={() => void documents.refresh()}
                                onApproved={() => void documents.refresh()}
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
                </TabsContent>
                <TabsContent value="form" className="m-0">
                    <ClearanceFormModule />
                </TabsContent>
                <TabsContent value="soa" className="m-0">
                    <ClearanceSoaModule />
                </TabsContent>
                <TabsContent value="quit-claims" className="m-0">
                    <ClearanceQuitClaimsModule />
                </TabsContent>
            </Tabs>
        </div>
    );
}

export function ClearanceWorkspace({ requestId }: { requestId: number }): JSX.Element {
    return (
        <Suspense>
            <ClearanceWorkspaceInner requestId={requestId} />
        </Suspense>
    );
}
