"use client";

import { useMemo, useState } from "react";
import type { JSX } from "react";
import { ClipboardCheck, Inbox, Printer, RotateCcw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ClearanceFilingStatusCard } from "./components/ClearanceFilingStatusCard";
import { ClearanceItemCard } from "./components/ClearanceItemCard";
import { ClearancePrintDialog } from "./components/ClearancePrintDialog";
import { SignItemDialog } from "./components/SignItemDialog";
import { useClearanceFiling } from "./hooks/useClearanceFiling";
import { useDialogTriggerFocus } from "./hooks/useDialogTriggerFocus";
import type { OwnRequestSummary, SignItemInput } from "./providers/clearanceFilingClient";
import { CLEARANCE_REQUEST_STATUS_LABELS } from "./types";
import { formatPHT } from "./utils/time";

interface ClearanceFilingModuleProps {
    requests: OwnRequestSummary[];
    loadError: string | null;
}

export function ClearanceFilingModule({ requests, loadError }: ClearanceFilingModuleProps): JSX.Element {
    const [selectedId, setSelectedId] = useState<number | null>(requests.length > 0 ? requests[0].id : null);
    const [signItemId, setSignItemId] = useState<number | null>(null);
    const [printOpen, setPrintOpen] = useState(false);
    const [mutating, setMutating] = useState(false);

    const effectiveId =
        selectedId !== null && requests.some((request) => request.id === selectedId)
            ? selectedId
            : (requests.length > 0 ? requests[0].id : null);

    const { detail, printable, candidatesByItem, failedItems, candidatesReady, loading, error, refresh, reloadCandidates, pick, sign } =
        useClearanceFiling(effectiveId);

    const captureSignTrigger = useDialogTriggerFocus(signItemId !== null);
    const capturePrintTrigger = useDialogTriggerFocus(printOpen);

    const namesById = useMemo(() => {
        const map = new Map<number, string>();
        if (printable) {
            for (const entry of printable.items) {
                if (entry.expected_signer_user_id !== null && entry.expected_signer_name) {
                    map.set(entry.expected_signer_user_id, entry.expected_signer_name);
                }
                if (entry.signed_by_user_id !== null && entry.signer_name) {
                    map.set(entry.signed_by_user_id, entry.signer_name);
                }
            }
        }
        for (const members of candidatesByItem.values()) {
            for (const candidate of members) {
                if (!map.has(candidate.user_id)) map.set(candidate.user_id, candidate.full_name);
            }
        }
        return map;
    }, [printable, candidatesByItem]);

    const printableById = useMemo(() => {
        const map = new Map<number, NonNullable<typeof printable>["items"][number]>();
        if (!printable) return map;
        for (const entry of printable.items) map.set(entry.id, entry);
        return map;
    }, [printable]);

    const signItem = signItemId !== null ? (detail?.items.find((item) => item.id === signItemId) ?? null) : null;

    function expectedNameFor(itemId: number, userId: number | null): string | null {
        if (userId === null) return null;
        return printableById.get(itemId)?.expected_signer_name ?? namesById.get(userId) ?? null;
    }

    function signerNameFor(itemId: number, userId: number | null): string | null {
        if (userId === null) return null;
        return printableById.get(itemId)?.signer_name ?? namesById.get(userId) ?? null;
    }

    async function handlePick(itemId: number, userId: number): Promise<void> {
        setMutating(true);
        try {
            await pick(itemId, userId);
            toast.success("Signer saved.");
        } finally {
            setMutating(false);
        }
    }

    async function handleSign(input: SignItemInput): Promise<void> {
        if (signItemId === null) return;
        setMutating(true);
        try {
            await sign(signItemId, input);
            toast.success("Signature saved.");
        } finally {
            setMutating(false);
        }
    }

    if (loadError) {
        return (
            <div className="space-y-6">
                <ModuleHeading subtitle="Could not load your clearance." />
                <Card>
                    <CardContent className="space-y-3 pt-6">
                        <Alert variant="destructive">
                            <AlertTitle>Could not load your clearance.</AlertTitle>
                            <AlertDescription>{loadError}</AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (requests.length === 0) {
        return (
            <div className="space-y-6">
                <ModuleHeading subtitle="Nothing assigned to you right now." />
                <Card>
                    <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <Inbox className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <p className="text-sm font-semibold">No clearance assigned to you.</p>
                        <p className="max-w-sm text-sm text-muted-foreground">
                            When HR assigns a clearance form to your approved resignation, it will appear here.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <ModuleHeading
                    subtitle={
                        loading
                            ? "Loading your clearance…"
                            : error
                              ? "Could not load your clearance."
                              : detail
                                ? `${detail.signed_count} of ${detail.total_count} categories signed`
                                : "Your clearance form."
                    }
                />
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading || mutating}>
                        <RotateCcw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden="true" />
                        Refresh
                    </Button>
                    {detail && (
                        <Button
                            size="sm"
                            onClick={() => {
                                capturePrintTrigger();
                                setPrintOpen(true);
                            }}
                            disabled={loading}
                        >
                            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                            Print
                        </Button>
                    )}
                </div>
            </div>

            {requests.length > 1 && (
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="clearance-request-picker">Clearance form</Label>
                    <select
                        id="clearance-request-picker"
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm sm:max-w-md"
                        value={effectiveId !== null ? String(effectiveId) : ""}
                        onChange={(e) => setSelectedId(Number(e.target.value))}
                    >
                        {requests.map((request) => (
                            <option key={request.id} value={String(request.id)}>
                                {request.template_title_snapshot ?? "Resignation Clearance"} —{" "}
                                {CLEARANCE_REQUEST_STATUS_LABELS[request.status]} — Assigned{" "}
                                {formatPHT(request.created_at, { includeTime: false })}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {loading && !detail ? (
                <div className="space-y-3">
                    <Skeleton className="h-44 w-full rounded-xl" />
                    <Skeleton className="h-40 w-full rounded-xl" />
                    <Skeleton className="h-40 w-full rounded-xl" />
                </div>
            ) : error || !detail ? (
                <Card>
                    <CardContent className="space-y-3 pt-6">
                        <Alert variant="destructive">
                            <AlertTitle>Could not load your clearance.</AlertTitle>
                            <AlertDescription>{error ?? "Please try again."}</AlertDescription>
                        </Alert>
                        <Button variant="outline" size="sm" onClick={() => void refresh()}>
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <ClearanceFilingStatusCard
                        detail={detail}
                        employeeName={printable?.employee_name ?? "Employee"}
                    />
                    <ItemGroup
                        title="Needs signature"
                        items={detail.items.filter((item) => item.status !== "signed")}
                    >
                        {(item) => (
                            <ClearanceItemCard
                                key={item.id}
                                item={item}
                                expectedName={expectedNameFor(item.id, item.expected_signer_user_id)}
                                signerName={signerNameFor(item.id, item.signed_by_user_id)}
                                substituted={
                                    item.signed_by_user_id !== null &&
                                    item.expected_signer_user_id !== null &&
                                    item.signed_by_user_id !== item.expected_signer_user_id
                                }
                                candidates={candidatesByItem.get(item.id) ?? []}
                                candidatesFailed={failedItems.includes(item.id)}
                                candidatesResolved={candidatesReady}
                                locked={detail.status === "completed" || mutating}
                                busy={mutating}
                                onRetryCandidates={() => void reloadCandidates()}
                                onPick={(userId) => handlePick(item.id, userId)}
                                onOpenSign={() => {
                                    captureSignTrigger();
                                    setSignItemId(item.id);
                                }}
                            />
                        )}
                    </ItemGroup>
                    <ItemGroup
                        title="Signed"
                        items={detail.items.filter((item) => item.status === "signed")}
                    >
                        {(item) => (
                            <ClearanceItemCard
                                key={item.id}
                                item={item}
                                expectedName={expectedNameFor(item.id, item.expected_signer_user_id)}
                                signerName={signerNameFor(item.id, item.signed_by_user_id)}
                                substituted={
                                    item.signed_by_user_id !== null &&
                                    item.expected_signer_user_id !== null &&
                                    item.signed_by_user_id !== item.expected_signer_user_id
                                }
                                candidates={candidatesByItem.get(item.id) ?? []}
                                candidatesFailed={failedItems.includes(item.id)}
                                candidatesResolved={candidatesReady}
                                locked={detail.status === "completed" || mutating}
                                busy={mutating}
                                onRetryCandidates={() => void reloadCandidates()}
                                onPick={(userId) => handlePick(item.id, userId)}
                                onOpenSign={() => {
                                    captureSignTrigger();
                                    setSignItemId(item.id);
                                }}
                            />
                        )}
                    </ItemGroup>
                    <SignItemDialog
                        item={signItem}
                        expectedName={
                            signItem
                                ? (printableById.get(signItem.id)?.expected_signer_name ??
                                  namesById.get(signItem.expected_signer_user_id ?? -1) ??
                                  null)
                                : null
                        }
                        candidates={signItem ? (candidatesByItem.get(signItem.id) ?? []) : []}
                        open={signItem !== null}
                        onOpenChange={(open) => {
                            if (!open) setSignItemId(null);
                        }}
                        onConfirm={handleSign}
                    />
                    <ClearancePrintDialog
                        detail={detail}
                        printable={printable}
                        open={printOpen}
                        onOpenChange={setPrintOpen}
                    />
                </>
            )}
        </div>
    );
}

function ItemGroup<T extends { id: number }>({
    title,
    items,
    children,
}: {
    title: string;
    items: readonly T[];
    children: (item: T) => JSX.Element;
}): JSX.Element | null {
    if (items.length === 0) return null;
    return (
        <section aria-label={`${title} — ${items.length} ${items.length === 1 ? "category" : "categories"}`} className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">
                {title} ({items.length})
            </h3>
            {items.map((item) => children(item))}
        </section>
    );
}

function ModuleHeading({ subtitle }: { subtitle: string }): JSX.Element {
    return (
        <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] border bg-card text-primary shadow-sm">
                <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold tracking-tight">My Clearance</h2>
                <p className="text-xs text-muted-foreground tabular-nums">{subtitle}</p>
            </div>
        </div>
    );
}

export default ClearanceFilingModule;
