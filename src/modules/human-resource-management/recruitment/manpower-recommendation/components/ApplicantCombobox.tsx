"use client";

import { useState } from "react";
import { useManpowerRecommendation } from "../hooks/useManpowerRecommendation";
import type { ManpowerRecommendation } from "../types";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useCommandState } from "cmdk";
import { FormControl } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { ChevronsUpDown } from "lucide-react";

// A request/candidate pair is only blocked while its recommendation is ACTIVE;
// terminal artifacts (Rejected/Withdrawn) must not hide the pair forever
// (S4 finding #10).
const ACTIVE_RECOMMENDATION_STATUSES = ["Recommended", "Approved", "Hired"] as const;

interface ApplicantEmptyStateProps {
    poolEmpty: boolean;
    hasActiveRecommendationForRequest: boolean;
    hasRecommendableApplicants: boolean;
}

/**
 * Reason-aware empty state for the applicant picker.
 *
 * The reason is read from the REQUEST's own state, never the transient ready
 * pool: creating a recommendation advances the applicant OUT of
 * `verdict_pending`, so on reopening the picker the ready pool is empty even
 * though the real exclusion is "already recommended for this request" (S4
 * re-QA round-2 N1). The request's recommendation rows do NOT move with that
 * advance, so they are the stable signal for the exclusion.
 */
function ApplicantEmptyState({ poolEmpty, hasActiveRecommendationForRequest, hasRecommendableApplicants }: ApplicantEmptyStateProps) {
    const search = useCommandState((state) => state.search).trim();
    const gradedCopy = (
        <>
            <span className="block font-medium">No applicant is ready to recommend.</span>
            <span className="mt-1 block text-xs text-muted-foreground">Applicants appear once their Initial interview is graded Passed.</span>
        </>
    );
    if (poolEmpty && hasActiveRecommendationForRequest) {
        return (
            <>
                <span className="block font-medium">All eligible candidates for this request already have an active recommendation.</span>
                <span className="mt-1 block text-xs text-muted-foreground">They reappear once that recommendation is no longer active.</span>
            </>
        );
    }
    if (!hasRecommendableApplicants) {
        return gradedCopy;
    }
    if (search) {
        return (
            <>
                <span className="block font-medium">No applicant matches “{search}”.</span>
                <span className="mt-1 block text-xs text-muted-foreground">Try a different name.</span>
            </>
        );
    }
    return gradedCopy;
}

interface ApplicantComboboxProps {
    value: number | undefined;
    onChange: (applicantId: number) => void;
}

/**
 * Applicant picker for the Recommend dialog. The pool is exactly what the
 * create path can advance to `recommended`: `can_recommend` is derived
 * server-side from the single-writer transition table (S4 findings #1/#2), and
 * position-matched candidates are grouped first, with the rest flagged under
 * "Other positions" instead of dead-ending the picker (S4 finding #7).
 */
export function ApplicantCombobox({ value, onChange }: ApplicantComboboxProps) {
    const { applicants, recommendations, openRequests, pendingRequestId } = useManpowerRecommendation();
    const [open, setOpen] = useState(false);

    const pendingRequest = openRequests.find((r) => r.id === pendingRequestId) ?? null;
    const normalizePosition = (position: string | null | undefined) => (position ?? "").trim().toLowerCase();
    const requestPosition = normalizePosition(pendingRequest?.position);
    const isActiveRecommendation = (rec: ManpowerRecommendation) =>
        (ACTIVE_RECOMMENDATION_STATUSES as readonly string[]).includes(rec.status);
    const hasActiveRecommendation = (applicantId: number) =>
        recommendations.some(
            (rec) =>
                rec.manpower_request_id === pendingRequestId &&
                rec.applicant_id === applicantId &&
                isActiveRecommendation(rec),
        );
    const readyApplicants = applicants.filter((applicant) => applicant.can_recommend);
    const eligibleApplicants = readyApplicants.filter((applicant) => !hasActiveRecommendation(applicant.id));
    // Empty-state reason is derived from the REQUEST itself (S4 re-QA round-2 N1):
    // creating a recommendation advances the applicant out of `verdict_pending`,
    // so the ready pool empties in the natural post-create flow. The request's own
    // active-recommendation rows do NOT move with that advance, so they are the
    // stable signal that the exclusion is "already recommended", not "not graded".
    const hasActiveRecommendationForRequest = recommendations.some(
        (rec) => rec.manpower_request_id === pendingRequestId && isActiveRecommendation(rec),
    );
    const isPositionMatch = (position: string) => requestPosition === "" || normalizePosition(position) === requestPosition;
    const groups = [
        {
            key: "matching",
            heading: pendingRequest ? `For ${pendingRequest.position}` : "Applicants",
            isOther: false,
            items: eligibleApplicants.filter((applicant) => isPositionMatch(applicant.position_applied_for)),
        },
        {
            key: "other",
            heading: <span className="text-amber-600">Other positions — different from {pendingRequest?.position ?? "this request"}</span>,
            isOther: true,
            items: eligibleApplicants.filter((applicant) => !isPositionMatch(applicant.position_applied_for)),
        },
    ].filter((group) => group.items.length > 0);
    const selected = applicants.find((applicant) => applicant.id === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <FormControl>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "w-full justify-between bg-muted/30 focus:bg-background transition-colors font-normal",
                            !value && "text-muted-foreground"
                        )}
                    >
                        <span className="truncate">{selected?.full_name || "Select applicant"}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search applicant..." />
                    <CommandList className="max-h-64 overflow-y-auto overscroll-contain">
                        <CommandEmpty>
                            <ApplicantEmptyState
                                poolEmpty={eligibleApplicants.length === 0}
                                hasActiveRecommendationForRequest={hasActiveRecommendationForRequest}
                                hasRecommendableApplicants={readyApplicants.length > 0}
                            />
                        </CommandEmpty>
                        {groups.map((group) => (
                            <CommandGroup key={group.key} heading={group.heading}>
                                {group.items.map((applicant) => (
                                    <CommandItem
                                        value={`${applicant.full_name} ${applicant.id}`}
                                        key={applicant.id}
                                        onSelect={() => {
                                            onChange(applicant.id);
                                            setOpen(false);
                                        }}
                                    >
                                        <span className="min-w-0 flex-[55] truncate" title={applicant.full_name}>
                                            {applicant.full_name}
                                        </span>
                                        <span
                                            className={`flex-[45] shrink-0 truncate pl-4 text-xs ${group.isOther ? "text-amber-600" : "text-muted-foreground"}`}
                                            title={applicant.position_applied_for || undefined}
                                        >
                                            {applicant.position_applied_for || "—"}
                                        </span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
