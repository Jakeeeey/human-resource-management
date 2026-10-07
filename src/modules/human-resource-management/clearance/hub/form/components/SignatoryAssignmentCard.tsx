"use client";

import type { JSX } from "react";
import { Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableCombobox as SignatoryCombobox } from "@/modules/human-resource-management/clearance/hub/utils/SearchableCombobox";
import type {
    RequestSignatoryCandidate,
    RequestSignatoryItem,
} from "../hooks/useRequestSignatories";

const NONE_VALUE = "none";

function scopeCaption(item: RequestSignatoryItem): string {
    if (item.signer_type_snapshot === "named_department") {
        return item.department_name_snapshot ?? "Assigned department";
    }
    if (item.signer_type_snapshot === "subject_department") {
        return "Employee's department";
    }
    if (item.signer_type_snapshot === "pool") {
        return "Template pool";
    }
    return "Anyone in the directory";
}

function scopeTone(signerType: string): "secondary" | "outline" {
    return signerType === "all" ? "outline" : "secondary";
}

interface SignatoryAssignmentCardProps {
    items: readonly RequestSignatoryItem[];
    candidates: Record<number, RequestSignatoryCandidate[]>;
    selections: Record<number, number | null>;
    onSelect: (itemId: number, signatoryId: number | null) => void;
    disabled: boolean;
    isLoading: boolean;
    error: string | null;
    onRetry: () => void;
}

export function SignatoryAssignmentCard({
    items,
    candidates,
    selections,
    onSelect,
    disabled,
    isLoading,
    error,
    onRetry,
}: SignatoryAssignmentCardProps): JSX.Element {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    Signatories
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-3" aria-label="Loading signatories">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                    </div>
                ) : error ? (
                    <div className="space-y-3">
                        <p className="text-sm text-destructive">{error}</p>
                        <Button variant="outline" size="sm" onClick={onRetry}>
                            Retry
                        </Button>
                    </div>
                ) : items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        This request has no clearance categories to assign.
                    </p>
                ) : (
                    <ul className="grid gap-3 md:grid-cols-2">
                        {items.map((item) => {
                            const options = candidates[item.id] ?? [];
                            const value = selections[item.id] ?? null;
                            return (
                                <li
                                    key={item.id}
                                    className="flex flex-col gap-3 rounded-lg border p-3 sm:p-4"
                                >
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="min-w-0 flex-1 text-sm font-semibold">
                                                {item.label_snapshot}
                                            </p>
                                            <Badge variant={scopeTone(item.signer_type_snapshot)}>
                                                {scopeCaption(item)}
                                            </Badge>
                                            {item.status === "signed" ? (
                                                <Badge variant="default">Signed</Badge>
                                            ) : null}
                                        </div>
                                        {item.instructions_snapshot ? (
                                            <p className="text-xs text-muted-foreground">
                                                {item.instructions_snapshot}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div className="w-full">
                                        {options.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">
                                            No eligible signers found for this category.
                                        </p>
                                    ) : (
                                        <SignatoryCombobox
                                            options={[
                                                { value: NONE_VALUE, label: "No signatory assigned" },
                                                ...options.map((candidate) => ({
                                                    value: String(candidate.user_id),
                                                    label: candidate.department_name
                                                        ? `${candidate.full_name} · ${candidate.department_name}`
                                                        : candidate.full_name,
                                                })),
                                            ]}
                                            value={value === null ? NONE_VALUE : String(value)}
                                            onValueChange={(next) => {
                                                if (next === NONE_VALUE) {
                                                    onSelect(item.id, null);
                                                    return;
                                                }
                                                const parsed = Number(next);
                                                onSelect(
                                                    item.id,
                                                    Number.isInteger(parsed) && parsed > 0 ? parsed : null
                                                );
                                            }}
                                            placeholder="Select a signatory"
                                            disabled={disabled || item.status === "signed"}
                                            id={`signatory-${item.id}`}
                                        />
                                    )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
