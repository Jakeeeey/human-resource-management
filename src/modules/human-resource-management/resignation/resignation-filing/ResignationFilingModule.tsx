"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Ban, Inbox, RefreshCw } from "lucide-react";
import { ResignationAttachmentDialog } from "./components/ResignationAttachmentDialog";
import { ResignationFilingForm } from "./components/ResignationFilingForm";
import { ResignationFilingStatusPanel } from "./components/ResignationFilingStatusPanel";
import { ResignationStatusCard } from "./components/ResignationStatusCard";
import { useResignationFiling } from "./hooks/useResignationFiling";
import { ResignationFilingProvider } from "./providers/ResignationFilingProvider";
import type { ResignationEligibility } from "./cooldown";
import { formatPHT } from "./utils/time";

function eligibilityMessage(eligibility: ResignationEligibility): string {
    if (eligibility.canFile) {
        return "";
    }
    if (eligibility.reason === "pending") {
        return "You already have a pending resignation filing under review.";
    }
    if (eligibility.reason === "approved") {
        return "Your resignation has already been approved, so you cannot file again.";
    }
    if (eligibility.reason === "cooling_down") {
        if (eligibility.nextAllowedAt) {
            return `You can file a new resignation on ${formatPHT(eligibility.nextAllowedAt, { includeTime: false })}.`;
        }
        return "You cannot file a new resignation until your cooling-off period ends.";
    }
    return "You cannot file a new resignation at this time.";
}

export default function ResignationFilingModule() {
    return (
        <ResignationFilingProvider>
            <ResignationFilingContent />
        </ResignationFilingProvider>
    );
}

function ResignationFilingContent() {
    const {
        filings,
        eligibility,
        total,
        isLoading,
        error,
        refresh,
        previewFiling,
        openPreview,
        closePreview,
        withdrawTarget,
        requestWithdraw,
        cancelWithdraw,
        confirmWithdraw,
        isWithdrawing,
    } = useResignationFiling();

    if (error) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Resignation Filing</h1>
                    </div>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Resignation Filing</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                        <div className="mt-4">
                            <Button onClick={refresh} variant="outline">
                                Retry
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const canFile = eligibility !== null && eligibility.canFile;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Resignation Filing</h1>
                </div>
                <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading} className="gap-2">
                    <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                    Refresh
                </Button>
            </div>

            {isLoading ? (
                <div className="grid gap-6 lg:grid-cols-12">
                    <div className="space-y-3 lg:col-span-8">
                        <Skeleton className="h-64 w-full rounded-xl" />
                    </div>
                    <div className="lg:col-span-4">
                        <Skeleton className="h-64 w-full rounded-xl" />
                    </div>
                </div>
            ) : (
                <>
                    <div className="grid gap-6 lg:grid-cols-12">
                        <div className="lg:col-span-8">
                            {eligibility !== null && !canFile && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Ban className="h-5 w-5 text-destructive" />
                                            You cannot file right now
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <p className="text-sm">{eligibilityMessage(eligibility)}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Your existing filings are listed below.
                                        </p>
                                    </CardContent>
                                </Card>
                            )}
                            {eligibility !== null && canFile && <ResignationFilingForm />}
                        </div>
                        <div className="lg:col-span-4">
                            <div className="lg:sticky lg:top-4">
                                <ResignationFilingStatusPanel eligibility={eligibility} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold tracking-tight">My filings</h2>
                            <p className="text-sm text-muted-foreground">
                                Showing <span className="font-semibold">{filings.length}</span> of{" "}
                                <span className="font-semibold">{total}</span> {total === 1 ? "filing" : "filings"}
                            </p>
                        </div>
                        {filings.length === 0 ? (
                            <Card>
                                <CardContent className="flex items-center justify-center gap-3 py-6 text-center">
                                    <Inbox className="h-5 w-5 shrink-0 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">
                                        No resignation filings yet. New filings will appear here.
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            filings.map((filing) => (
                                <ResignationStatusCard
                                    key={filing.id ?? `${filing.resignation_date}-${filing.filed_at}`}
                                    filing={filing}
                                    onPreview={openPreview}
                                    onWithdraw={requestWithdraw}
                                />
                            ))
                        )}
                    </div>
                </>
            )}

            <ResignationAttachmentDialog open={previewFiling !== null} filing={previewFiling} onClose={closePreview} />

            <AlertDialog open={withdrawTarget !== null} onOpenChange={(value) => !value && cancelWithdraw()}>
                <AlertDialogContent className="sm:max-w-[480px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Withdraw this filing?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Your pending resignation filing will be withdrawn. This cannot be undone, but you may file again afterwards.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isWithdrawing}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmWithdraw} disabled={isWithdrawing}>
                            {isWithdrawing ? "Withdrawing..." : "Withdraw"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
