"use client";

import { useMemo, useState } from "react";
import type { JSX, ReactNode } from "react";
import { CheckCircle2, ChevronDown, ClipboardCheck, Inbox, Printer, RotateCcw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { toast } from "sonner";
import { ClearanceItemCard } from "./components/ClearanceItemCard";
import { ClearancePrintDialog } from "./components/ClearancePrintDialog";
import { ClearanceRequestCombobox } from "./components/ClearanceRequestCombobox";
import { SignItemDialog } from "./components/SignItemDialog";
import { useClearanceFiling } from "./hooks/useClearanceFiling";
import { useDialogTriggerFocus } from "./hooks/useDialogTriggerFocus";
import type { OwnRequestSummary, SignItemInput, FilingItem } from "./providers/clearanceFilingClient";
import { CLEARANCE_REQUEST_STATUS_LABELS, type ClearanceRequestStatus } from "./types";
import { formatPHT } from "./utils/time";

interface ClearanceFilingModuleProps {
    requests: OwnRequestSummary[];
    loadError: string | null;
}

function statusTone(status: ClearanceRequestStatus): StatusTone {
    if (status === "completed") return "success";
    if (status === "in_progress") return "info";
    return "neutral";
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

    const requestOptions = useMemo(
        () =>
            requests.map((request) => ({
                value: String(request.id),
                label: `${request.template_title_snapshot ?? "Resignation Clearance"} — Assigned ${formatPHT(request.created_at, { includeTime: false })}`,
            })),
        [requests]
    );

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

    function renderItemCard(item: FilingItem): JSX.Element {
        return (
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
                locked={detail?.status === "completed" || mutating}
                busy={mutating}
                onRetryCandidates={() => void reloadCandidates()}
                onPick={(userId) => handlePick(item.id, userId)}
                onOpenSign={() => {
                    captureSignTrigger();
                    setSignItemId(item.id);
                }}
            />
        );
    }

    if (loadError) {
        return (
            <div className="mx-auto min-h-screen max-w-[1600px] space-y-6 p-2 sm:p-6 md:p-10">
                <WorkspaceHeading
                    title="My Clearance"
                    description="Could not load your clearance."
                    status={null}
                />
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
            <div className="mx-auto min-h-screen max-w-[1600px] space-y-6 p-2 sm:p-6 md:p-10">
                <WorkspaceHeading
                    title="My Clearance"
                    description="Nothing assigned to you right now."
                    status={null}
                />
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

    const pendingItems = detail?.items.filter((item) => item.status !== "signed") ?? [];
    const signedItems = detail?.items.filter((item) => item.status === "signed") ?? [];
    const employeeName = printable?.employee_name ?? "Employee";

    return (
        <div className="mx-auto min-h-screen max-w-[1600px] space-y-6 p-2 sm:p-6 md:p-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <WorkspaceHeading
                    title="My Clearance"
                    description="Collect each category signature to complete your clearance."
                    status={detail ? detail.status : null}
                />
                <div className="flex shrink-0 gap-2">
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
                <div className="flex flex-col gap-1.5 sm:max-w-md">
                    <Label htmlFor="clearance-request-picker">Clearance form</Label>
                    <ClearanceRequestCombobox
                        id="clearance-request-picker"
                        options={requestOptions}
                        value={effectiveId !== null ? String(effectiveId) : ""}
                        onValueChange={(value) => setSelectedId(Number(value))}
                        disabled={loading}
                    />
                </div>
            )}

            {loading && !detail ? (
                <div className="space-y-6" aria-label="Loading clearance">
                    <Skeleton className="h-44 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-64 w-full rounded-xl" />
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
                <div className="space-y-6">
                    <Card>
                        <CardContent className="space-y-1 p-4 sm:p-6">
                            <div className="min-w-0 space-y-1">
                                <h2 className="text-xl font-semibold sm:text-2xl">
                                    {detail.template_title_snapshot ?? "Resignation Clearance"}
                                </h2>
                                <dl className="grid grid-cols-2 gap-4 pt-2 lg:grid-cols-3">
                                    <div className="min-w-0">
                                        <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                            Employee
                                        </dt>
                                        <dd className="mt-1 truncate text-sm font-semibold" title={employeeName}>
                                            {employeeName}
                                        </dd>
                                    </div>
                                    <div className="min-w-0">
                                        <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                            Assigned
                                        </dt>
                                        <dd className="mt-1 text-sm font-semibold tabular-nums">
                                            {formatPHT(detail.created_at)}
                                        </dd>
                                    </div>
                                    <div className="min-w-0">
                                        <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                            Progress
                                        </dt>
                                        <dd className="mt-1 text-sm font-semibold tabular-nums">
                                            {detail.signed_count} of {detail.total_count} signed
                                        </dd>
                                    </div>
                                </dl>
                                <div className="pt-2">
                                    <Progress
                                        value={
                                            detail.total_count > 0
                                                ? Math.round((detail.signed_count / detail.total_count) * 100)
                                                : 0
                                        }
                                        aria-label={`${detail.signed_count} of ${detail.total_count} signed`}
                                    />
                                </div>
                                {detail.status === "completed" && (
                                    <p className="pt-1 text-xs text-muted-foreground">
                                        This clearance is completed and locked. Contact HR if a correction is needed.
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {detail.items.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <p className="text-muted-foreground">No categories on this clearance.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            <ItemGroup
                                title="Needs signature"
                                items={pendingItems}
                                empty={
                                    <Alert>
                                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                        <AlertTitle>Every category is signed.</AlertTitle>
                                        <AlertDescription>
                                            Nothing left to collect — your clearance is ready.
                                        </AlertDescription>
                                    </Alert>
                                }
                            >
                                {(item) => renderItemCard(item)}
                            </ItemGroup>
                            <ItemGroup
                                title="Signed"
                                items={signedItems}
                                collapsed
                                empty={
                                    <div className="rounded-xl border border-dashed p-4 text-center">
                                        <p className="text-sm text-muted-foreground">
                                            Nothing signed yet — completed signatures will appear here.
                                        </p>
                                    </div>
                                }
                            >
                                {(item) => renderItemCard(item)}
                            </ItemGroup>
                        </>
                    )}
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
                </div>
            )}
        </div>
    );
}

function ItemGroup<T extends { id: number }>({
    title,
    items,
    empty,
    collapsed = false,
    children,
}: {
    title: string;
    items: readonly T[];
    empty?: ReactNode;
    collapsed?: boolean;
    children: (item: T) => JSX.Element;
}): JSX.Element {
    const label = `${title} — ${items.length} ${items.length === 1 ? "category" : "categories"}`;
    if (!collapsed) {
        return (
            <section aria-label={label} className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">
                    {title} ({items.length})
                </h3>
                {items.length > 0 ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                        {items.map((item) => children(item))}
                    </div>
                ) : (empty ?? null)}
            </section>
        );
    }
    return (
        <section aria-label={label} className="space-y-3">
            <Collapsible>
                <CollapsibleTrigger asChild>
                    <button
                        type="button"
                        className="flex w-full items-center gap-2 text-left text-sm font-semibold text-muted-foreground [&[data-state=open]>svg]:rotate-180"
                    >
                        {title} ({items.length})
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform" aria-hidden="true" />
                    </button>
                </CollapsibleTrigger>
                {items.length > 0 ? (
                    <CollapsibleContent>
                        <div className="grid gap-4 pt-3 lg:grid-cols-2">
                            {items.map((item) => children(item))}
                        </div>
                    </CollapsibleContent>
                ) : (empty ?? null)}
            </Collapsible>
        </section>
    );
}

function WorkspaceHeading({
    title,
    description,
    status,
}: {
    title: string;
    description: string;
    status: ClearanceRequestStatus | null;
}): JSX.Element {
    return (
        <div className="flex min-w-0 items-start gap-4">
            <div className="shrink-0 rounded-2xl bg-primary/10 p-3">
                <ClipboardCheck className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold sm:text-4xl">{title}</h1>
                    {status ? (
                        <StatusBadge tone={statusTone(status)}>
                            {CLEARANCE_REQUEST_STATUS_LABELS[status]}
                        </StatusBadge>
                    ) : null}
                </div>
                <p className="text-base text-muted-foreground sm:text-lg">{description}</p>
            </div>
        </div>
    );
}

export default ClearanceFilingModule;
