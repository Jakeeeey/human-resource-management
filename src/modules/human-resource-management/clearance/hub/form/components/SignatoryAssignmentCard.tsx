"use client";

import { useMemo, useState } from "react";
import type { JSX } from "react";
import { Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableCombobox as SignatoryCombobox } from "@/modules/human-resource-management/clearance/hub/utils/SearchableCombobox";
import type {
    RequestSignatoryCandidate,
    RequestSignatoryItem,
} from "../hooks/useRequestSignatories";

const NONE_VALUE = "none";
const PAGE_SIZE = 10;

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
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const filteredItems = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (needle === "") return items;
        return items.filter((item) => item.label_snapshot.toLowerCase().includes(needle));
    }, [items, query]);
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    const visibleItems = filteredItems.slice(start, start + PAGE_SIZE);
    const rangeStart = filteredItems.length === 0 ? 0 : start + 1;
    const rangeEnd = Math.min(start + PAGE_SIZE, filteredItems.length);
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
                    <div className="space-y-3">
                        <div className="w-full space-y-2 sm:max-w-xs">
                            <Label htmlFor="signatory-filter">Filter signatories</Label>
                            <Input
                                id="signatory-filter"
                                value={query}
                                disabled={disabled}
                                onChange={(event) => {
                                    setQuery(event.target.value);
                                    setPage(1);
                                }}
                                placeholder="Search signatories..."
                            />
                        </div>
                        {filteredItems.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No signatories match the current filter.
                            </p>
                        ) : (
                        <ul className="grid gap-3 md:grid-cols-2">
                        {visibleItems.map((item) => {
                            const options = candidates[item.id] ?? [];
                            const value = selections[item.id] ?? null;
                            return (
                                <li
                                    key={item.id}
                                    className="flex flex-col gap-3 rounded-lg border p-3 sm:p-4"
                                >
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Label
                                                htmlFor={`signatory-${item.id}`}
                                                className="min-w-0 flex-1 text-sm font-semibold"
                                            >
                                                {item.label_snapshot}
                                            </Label>
                                            <Badge variant={scopeTone(item.signer_type_snapshot)}>
                                                {scopeCaption(item)}
                                            </Badge>
                                            {item.status === "signed" ? (
                                                <Badge variant="default">Signed</Badge>
                                            ) : (
                                                <Badge variant="outline">Pending</Badge>
                                            )}
                                        </div>
                                        {item.instructions_snapshot ? (
                                            <p className="text-xs text-muted-foreground">
                                                {item.instructions_snapshot}
                                            </p>
                                        ) : null}
                                        {item.remarks ? (
                                            <p className="text-xs text-muted-foreground break-words">
                                                Remarks: {item.remarks}
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
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground" aria-live="polite">
                                Showing {rangeStart}–{rangeEnd} of {filteredItems.length} {filteredItems.length === 1 ? "signatory" : "signatories"}
                            </p>
                            {totalPages > 1 ? (
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(safePage - 1)}
                                        disabled={safePage <= 1}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(safePage + 1)}
                                        disabled={safePage >= totalPages}
                                    >
                                        Next
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
