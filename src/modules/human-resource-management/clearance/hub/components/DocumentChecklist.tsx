"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { JSX } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Loader2 } from "lucide-react";

import {
    CLEARANCE_DOCUMENT_LABELS,
    CLEARANCE_DOCUMENT_STATE_LABELS,
    type ClearanceDocumentChecklist,
    type ClearanceDocumentEntry,
    type ClearanceDocumentState,
} from "../types";
import { clearanceHubTabForDocument, clearanceHubTabHref } from "../utils/documentTabs";
import {
    COMPANY_LOGOS_PATH,
    pickDefaultCompany,
    readCompanyOptions,
    type CompanyOption,
} from "../utils/company";
import { phToday } from "../utils/time";
import styles from "./hub-status.module.css";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function entryTone(state: ClearanceDocumentState): StatusTone {
    if (state === "approved") return "success";
    if (state === "pending") return "info";
    return "neutral";
}

function entryClassName(state: ClearanceDocumentState): string {
    return state === "approved" ? styles.signed : styles.pending;
}

function ApproveDocumentDialog({
    entry,
    requestId,
    companies,
    companiesLoading,
    open,
    onOpenChange,
    onApproved,
}: {
    entry: ClearanceDocumentEntry;
    requestId: number;
    companies: CompanyOption[];
    companiesLoading: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onApproved: () => void;
}): JSX.Element {
    const [companyCode, setCompanyCode] = useState("");
    const [approving, setApproving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setError(null);
        setCompanyCode(pickDefaultCompany(companies)?.company_code ?? "");
    }, [open, companies]);

    async function handleApprove(): Promise<void> {
        const code = companyCode.trim();
        if (code === "" || approving) return;
        setApproving(true);
        setError(null);
        try {
            let url = "";
            let body: Record<string, unknown> = { company_code: code };
            if (entry.key === "form") {
                url = "/api/hrm/clearance/form/approve";
                body = { request_id: requestId, company_code: code, date: phToday() };
            } else if (entry.key === "soa") {
                url = "/api/hrm/clearance/soa/approve";
                body = { request_id: requestId, company_code: code };
            } else {
                if (entry.documentId === null) {
                    throw new Error("This quit claim has no document to approve yet.");
                }
                url = `/api/hrm/clearance/quit-claims/${entry.documentId}/approve`;
            }
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const payload: unknown = await res.json().catch(() => null);
            if (!res.ok || !isRecord(payload) || payload.success !== true) {
                const message = isRecord(payload) && typeof payload.message === "string" && payload.message.trim() !== ""
                    ? payload.message
                    : `Could not approve the ${CLEARANCE_DOCUMENT_LABELS[entry.key].toLowerCase()}. Please try again.`;
                throw new Error(message);
            }
            onOpenChange(false);
            onApproved();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not approve this document. Please try again.");
        } finally {
            setApproving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-lg"
                onFocusOutside={(event) => event.preventDefault()}
            >
                <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6">
                    <DialogTitle className="text-base">Approve {CLEARANCE_DOCUMENT_LABELS[entry.key]}</DialogTitle>
                    <DialogDescription>
                        Approving allocates the reference number and freezes the document. This cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    <div className="space-y-1">
                        <Label htmlFor={`approve-company-${entry.key}`}>Company</Label>
                        <Select value={companyCode} onValueChange={setCompanyCode} disabled={companiesLoading || approving}>
                            <SelectTrigger id={`approve-company-${entry.key}`} className="w-full">
                                <SelectValue
                                    placeholder={companiesLoading ? "Loading companies…" : "Choose a company"}
                                />
                            </SelectTrigger>
                            <SelectContent>
                                {companies.map((option) => (
                                    <SelectItem key={option.id} value={option.company_code}>
                                        {option.company_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            The reference number is allocated per company and year.
                        </p>
                    </div>
                </div>
                <DialogFooter className="shrink-0 flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end">
                    <Button
                        variant="outline"
                        className="w-full sm:w-auto"
                        disabled={approving}
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="default"
                        className="w-full sm:w-auto"
                        disabled={companyCode.trim() === "" || approving || companiesLoading}
                        onClick={() => void handleApprove()}
                    >
                        {approving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        {approving ? "Approving…" : "Approve"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ChecklistRow({
    entry,
    requestId,
    companies,
    companiesLoading,
    onApproved,
}: {
    entry: ClearanceDocumentEntry;
    requestId: number;
    companies: CompanyOption[];
    companiesLoading: boolean;
    onApproved: () => void;
}): JSX.Element {
    const router = useRouter();
    const tab = clearanceHubTabForDocument(entry.key);
    const [approveOpen, setApproveOpen] = useState(false);
    const canApprove = entry.state === "pending" && (entry.key !== "quit_claim" || entry.documentId !== null);
    return (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
            <div className="min-w-0">
                <p className="font-medium">{CLEARANCE_DOCUMENT_LABELS[entry.key]}</p>
                {entry.refNo ? (
                    <p className="text-xs text-muted-foreground tabular-nums">Ref {entry.refNo}</p>
                ) : (
                    <p className="text-xs text-muted-foreground">
                        {entry.state === "approved" ? "Approved" : "No reference yet"}
                    </p>
                )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <StatusBadge tone={entryTone(entry.state)} className={entryClassName(entry.state)}>
                    {CLEARANCE_DOCUMENT_STATE_LABELS[entry.state]}
                </StatusBadge>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                        router.push(clearanceHubTabHref(tab, requestId));
                    }}
                >
                    Open
                </Button>
                {entry.state === "approved" ? (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            router.push(clearanceHubTabHref(tab, requestId, true));
                        }}
                    >
                        Print
                    </Button>
                ) : null}
                {canApprove ? (
                    <Button
                        size="sm"
                        variant="default"
                        onClick={() => setApproveOpen(true)}
                    >
                        Approve
                    </Button>
                ) : null}
            </div>
            <ApproveDocumentDialog
                entry={entry}
                requestId={requestId}
                companies={companies}
                companiesLoading={companiesLoading}
                open={approveOpen}
                onOpenChange={setApproveOpen}
                onApproved={onApproved}
            />
        </div>
    );
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
            {checklist.approvedCount} of 3 approved
        </span>
    );
}

interface DocumentChecklistProps {
    checklist: ClearanceDocumentChecklist | null;
    isLoading?: boolean;
    error?: string | null;
    onRetry?: () => void;
    onApproved?: () => void;
}

export function DocumentChecklist({
    checklist,
    isLoading = false,
    error = null,
    onRetry,
    onApproved,
}: DocumentChecklistProps): JSX.Element {
    const [companies, setCompanies] = useState<CompanyOption[]>([]);
    const [companiesLoading, setCompaniesLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setCompaniesLoading(true);
        (async () => {
            try {
                const res = await fetch(COMPANY_LOGOS_PATH, { cache: "no-store" });
                if (!res.ok) throw new Error("company-list failed");
                const body: unknown = await res.json().catch(() => null);
                const parsed = readCompanyOptions(body) ?? [];
                if (!cancelled) setCompanies(parsed);
            } catch {
                if (!cancelled) setCompanies([]);
            } finally {
                if (!cancelled) setCompaniesLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

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
                            {checklist.approvedCount} of 3 approved
                        </span>
                    )}
                </div>
                <p className="text-sm text-muted-foreground">
                    {checklist.complete
                        ? "Clearance Form, SOA, and Quit Claims are all approved. This request is fully complete."
                        : "Full completion needs all three documents approved."}
                </p>
            </CardHeader>
            <CardContent className="space-y-2">
                <ChecklistRow
                    entry={checklist.form}
                    requestId={checklist.requestId}
                    companies={companies}
                    companiesLoading={companiesLoading}
                    onApproved={() => onApproved?.()}
                />
                <ChecklistRow
                    entry={checklist.soa}
                    requestId={checklist.requestId}
                    companies={companies}
                    companiesLoading={companiesLoading}
                    onApproved={() => onApproved?.()}
                />
                <ChecklistRow
                    entry={checklist.quitClaim}
                    requestId={checklist.requestId}
                    companies={companies}
                    companiesLoading={companiesLoading}
                    onApproved={() => onApproved?.()}
                />
            </CardContent>
        </Card>
    );
}
