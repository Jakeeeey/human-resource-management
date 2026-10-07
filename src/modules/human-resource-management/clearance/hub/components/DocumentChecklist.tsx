"use client";

import Link from "next/link";
import type { JSX } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

import {
    CLEARANCE_DOCUMENT_LABELS,
    CLEARANCE_DOCUMENT_STATE_LABELS,
    type ClearanceDocumentChecklist,
    type ClearanceDocumentEntry,
    type ClearanceDocumentKey,
    type ClearanceDocumentState,
} from "../types";
import styles from "./hub-status.module.css";

function entryTone(state: ClearanceDocumentState): StatusTone {
    if (state === "issued") return "success";
    if (state === "draft") return "info";
    return "neutral";
}

function entryClassName(state: ClearanceDocumentState): string {
    return state === "issued" ? styles.signed : styles.pending;
}

export function DocumentCompletionBadge({
    checklist,
}: {
    checklist: ClearanceDocumentChecklist;
}): JSX.Element {
    if (checklist.complete) {
        return (
            <StatusBadge tone="success" className={styles.signed}>
                Complete
            </StatusBadge>
        );
    }
    return (
        <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
            {checklist.issuedCount} of 3 issued
        </span>
    );
}

function documentBasePath(key: ClearanceDocumentKey): string {
    if (key === "soa") return "/hrm/clearance/soa";
    if (key === "quit_claim") return "/hrm/clearance/quit-claims";
    return "/hrm/clearance/clearance-form";
}

function documentHrefs(key: ClearanceDocumentKey, requestId: number): { openHref: string; printHref: string } {
    const base = documentBasePath(key);
    return {
        openHref: `${base}?request=${requestId}`,
        printHref: `${base}?request=${requestId}&print=1`,
    };
}

function ChecklistRow({ entry, requestId }: { entry: ClearanceDocumentEntry; requestId: number }): JSX.Element {
    const { openHref, printHref } = documentHrefs(entry.key, requestId);
    return (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
            <div className="min-w-0">
                <p className="font-medium">{CLEARANCE_DOCUMENT_LABELS[entry.key]}</p>
                {entry.refNo ? (
                    <p className="text-xs text-muted-foreground tabular-nums">Ref {entry.refNo}</p>
                ) : (
                    <p className="text-xs text-muted-foreground">
                        {entry.state === "issued" ? "Issued" : "No reference yet"}
                    </p>
                )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <StatusBadge tone={entryTone(entry.state)} className={entryClassName(entry.state)}>
                    {CLEARANCE_DOCUMENT_STATE_LABELS[entry.state]}
                </StatusBadge>
                <Button asChild size="sm" variant="outline">
                    <Link href={openHref}>Open</Link>
                </Button>
                {entry.state === "issued" ? (
                    <Button asChild size="sm" variant="outline">
                        <Link href={printHref}>Print</Link>
                    </Button>
                ) : null}
            </div>
        </div>
    );
}

interface DocumentChecklistProps {
    checklist: ClearanceDocumentChecklist | null;
    isLoading?: boolean;
    error?: string | null;
    onRetry?: () => void;
}

export function DocumentChecklist({
    checklist,
    isLoading = false,
    error = null,
    onRetry,
}: DocumentChecklistProps): JSX.Element {
    if (isLoading && !checklist) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-2/3" />
                </CardHeader>
                <CardContent className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                    ))}
                </CardContent>
            </Card>
        );
    }

    if (error || !checklist) {
        return (
            <Card>
                <CardContent className="space-y-4 pt-6">
                    <Alert variant="destructive">
                        <AlertDescription>
                            {error ?? "Document statuses could not be loaded."}
                        </AlertDescription>
                    </Alert>
                    {onRetry ? (
                        <Button onClick={onRetry} variant="outline" size="sm">
                            Retry
                        </Button>
                    ) : null}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">Document checklist</CardTitle>
                    {checklist.complete ? (
                        <StatusBadge tone="success" className={styles.signed}>
                            Complete
                        </StatusBadge>
                    ) : (
                        <span className="text-sm text-muted-foreground tabular-nums">
                            {checklist.issuedCount} of 3 issued
                        </span>
                    )}
                </div>
                <p className="text-sm text-muted-foreground">
                    {checklist.complete
                        ? "Clearance Form, SOA, and Quit Claims are all issued. This request is fully complete."
                        : "Full completion needs all three documents issued."}
                </p>
            </CardHeader>
            <CardContent className="space-y-2">
                <ChecklistRow entry={checklist.form} requestId={checklist.requestId} />
                <ChecklistRow entry={checklist.soa} requestId={checklist.requestId} />
                <ChecklistRow entry={checklist.quitClaim} requestId={checklist.requestId} />
            </CardContent>
        </Card>
    );
}
