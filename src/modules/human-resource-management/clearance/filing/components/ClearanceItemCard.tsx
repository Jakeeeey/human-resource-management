"use client";

import { useState } from "react";
import type { JSX } from "react";
import { AlertTriangle, CheckCircle2, Loader2, PenLine, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { CLEARANCE_ITEM_STATUS_LABELS, CLEARANCE_SIGNER_TYPE_LABELS } from "../types";
import type { FilingCandidate, FilingItem } from "../providers/clearanceFilingClient";
import { formatPHT } from "../utils/time";
import { SignerCombobox } from "./SignerCombobox";

interface ClearanceItemCardProps {
    item: FilingItem;
    expectedName: string | null;
    signerName: string | null;
    substituted: boolean;
    candidates: FilingCandidate[];
    candidatesFailed: boolean;
    candidatesResolved: boolean;
    locked: boolean;
    busy: boolean;
    onRetryCandidates: () => void;
    onPick: (userId: number) => Promise<void>;
    onOpenSign: () => void;
}

function statusTone(signed: boolean): StatusTone {
    return signed ? "success" : "warning";
}

export function ClearanceItemCard({
    item,
    expectedName,
    signerName,
    substituted,
    candidates,
    candidatesFailed,
    candidatesResolved,
    locked,
    busy,
    onRetryCandidates,
    onPick,
    onOpenSign,
}: ClearanceItemCardProps): JSX.Element {
    const signed = item.status === "signed";
    const [selectedId, setSelectedId] = useState<string>(
        item.expected_signer_user_id !== null ? String(item.expected_signer_user_id) : ""
    );
    const [pickBusy, setPickBusy] = useState(false);
    const [pickError, setPickError] = useState<string | null>(null);

    const selectedNumber = selectedId === "" ? null : Number(selectedId);
    const pickChanged =
        selectedNumber !== null &&
        (item.expected_signer_user_id === null || selectedNumber !== item.expected_signer_user_id);

    async function handlePick(): Promise<void> {
        if (selectedNumber === null || pickBusy || busy) return;
        setPickBusy(true);
        setPickError(null);
        try {
            await onPick(selectedNumber);
        } catch (err) {
            setPickError(err instanceof Error ? err.message : "Could not save your chosen signer.");
        } finally {
            setPickBusy(false);
        }
    }

    return (
        <Card className={signed ? "bg-muted/30" : undefined}>
            <CardHeader className="space-y-2 pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-sm">{item.label_snapshot}</CardTitle>
                    <StatusBadge tone={statusTone(signed)}>
                        {signed ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                        {CLEARANCE_ITEM_STATUS_LABELS[signed ? "signed" : "pending"]}
                    </StatusBadge>
                </div>
                {item.instructions_snapshot && (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {item.instructions_snapshot}
                    </p>
                )}
                <p className="text-xs text-muted-foreground">
                    Signer group: {CLEARANCE_SIGNER_TYPE_LABELS[item.signer_type_snapshot]}
                    {item.department_name_snapshot ? ` (${item.department_name_snapshot})` : ""}
                </p>
            </CardHeader>
            <CardContent className="space-y-3">
                {signed ? (
                    <div className="space-y-1 text-sm">
                        <p>
                            <span className="font-semibold">Signed by:</span> {signerName ?? "Unknown signer"}
                        </p>
                        {substituted && (
                            <p className="text-xs text-muted-foreground">
                                Chosen signer was {expectedName ?? "unknown"}. A different person signed on their behalf.
                            </p>
                        )}
                        {item.substitution_reason && (
                            <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                                <span className="font-semibold">Explanation:</span> {item.substitution_reason}
                            </p>
                        )}
                        {item.remarks && (
                            <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                                <span className="font-semibold">Note:</span> {item.remarks}
                            </p>
                        )}
                        <p className="text-xs text-muted-foreground tabular-nums">
                            Signed {formatPHT(item.signed_at)}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {item.expected_signer_user_id !== null && (
                            <p className="text-sm">
                                <span className="font-semibold">Chosen signer:</span>{" "}
                                {expectedName ?? "Loading name…"}
                            </p>
                        )}
                        {!locked && (
                            <>
                                {candidatesFailed ? (
                                    <Alert variant="destructive">
                                        <AlertTitle>Could not load the signer list.</AlertTitle>
                                        <AlertDescription className="space-y-2">
                                            <p>Check your connection and try again.</p>
                                            <Button variant="outline" size="sm" onClick={onRetryCandidates}>
                                                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                                                Retry
                                            </Button>
                                        </AlertDescription>
                                    </Alert>
                                ) : !candidatesResolved ? (
                                    <div className="space-y-2" role="status" aria-live="polite">
                                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                            Finding eligible signers…
                                        </p>
                                        <Skeleton className="h-9 w-full sm:max-w-sm" />
                                    </div>
                                ) : candidates.length === 0 ? (
                                    <Alert>
                                        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                                        <AlertTitle>No eligible signer for this category.</AlertTitle>
                                        <AlertDescription>
                                            There is no one available to sign this category right now. Please
                                            contact HR so they can assign someone.
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <div className="space-y-2">
                                        <Label htmlFor={`clearance-signer-${item.id}`}>
                                            {item.expected_signer_user_id === null
                                                ? "Choose who will sign this category"
                                                : "Change the signer"}
                                        </Label>
                                        <div className="flex flex-col gap-2 sm:flex-row">
                                            <SignerCombobox
                                                id={`clearance-signer-${item.id}`}
                                                candidates={candidates}
                                                value={selectedId}
                                                onValueChange={setSelectedId}
                                                disabled={pickBusy || busy}
                                            />
                                            <Button
                                                size="sm"
                                                onClick={() => void handlePick()}
                                                disabled={!pickChanged || pickBusy || busy}
                                            >
                                                {pickBusy ? "Saving…" : "Save signer"}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                {pickError && (
                                    <Alert variant="destructive">
                                        <AlertDescription>{pickError}</AlertDescription>
                                    </Alert>
                                )}
                                <div>
                                    <Button
                                        size="sm"
                                        variant={item.expected_signer_user_id === null ? "outline" : "default"}
                                        onClick={onOpenSign}
                                        disabled={item.expected_signer_user_id === null || busy}
                                    >
                                        <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
                                        Collect signature
                                    </Button>
                                    {item.expected_signer_user_id === null && (
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Choose a signer above before collecting the signature.
                                        </p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
