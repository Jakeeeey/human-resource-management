"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { useClearanceHubContext } from "../providers/ClearanceHubProvider";
import { ClearanceHubTable } from "./ClearanceHubTable";
import { AssignClearanceDialog } from "./AssignClearanceDialog";
import { useDocumentCompletionIndex } from "../hooks/useDocumentChecklist";
import {
    CLEARANCE_REQUEST_STATUS_LABELS,
    CLEARANCE_REQUEST_STATUSES,
    type ClearanceRequestStatus,
} from "../types";
import { useDialogTriggerFocus } from "../hooks/useDialogTriggerFocus";

type StatusFilter = "all" | ClearanceRequestStatus;

export function ClearanceHubOverview() {
    const { requests, resignations, isLoading, error, refresh } = useClearanceHubContext();
    const completion = useDocumentCompletionIndex();
    const searchParams = useSearchParams();

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const selectedId = useMemo(() => {
        const raw = searchParams.get("selected");
        if (raw === null) return null;
        const parsed = Number.parseInt(raw, 10);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }, [searchParams]);
    const [assignOpen, setAssignOpen] = useState(false);

    const captureAssignTrigger = useDialogTriggerFocus(assignOpen);

    const namesByResignation = useMemo(() => {
        const map = new Map<number, string>();
        for (const resignation of resignations) {
            map.set(resignation.id, resignation.employee_name);
        }
        return map;
    }, [resignations]);

    const filteredRequests = useMemo(() => {
        let filtered = [...requests];
        if (statusFilter !== "all") {
            filtered = filtered.filter((request) => request.status === statusFilter);
        }
        if (searchQuery.trim() !== "") {
            const query = searchQuery.trim().toLowerCase();
            filtered = filtered.filter((request) => {
                const employeeName = (namesByResignation.get(request.resignation_id) ?? "").toLowerCase();
                const templateTitle = (request.template_title_snapshot ?? "").toLowerCase();
                return employeeName.includes(query) || templateTitle.includes(query);
            });
        }
        return filtered;
    }, [requests, statusFilter, searchQuery, namesByResignation]);

    const effectiveSelectedId =
        selectedId !== null && filteredRequests.some((request) => request.id === selectedId)
            ? selectedId
            : (filteredRequests.length > 0 ? filteredRequests[0].id : null);

    const handleRetry = async () => {
        await refresh();
        await completion.refresh();
    };

    const resetFilters = () => {
        setSearchQuery("");
        setStatusFilter("all");
    };

    const hasActiveFilters = searchQuery.trim() !== "" || statusFilter !== "all";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Clearance Hub
                    </h1>
                    <p className="text-muted-foreground">
                        Assign and monitor resignation clearances
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRetry}
                        disabled={isLoading}
                        className="gap-2"
                    >
                        Refresh
                    </Button>
                    <Button size="sm" onClick={() => { captureAssignTrigger(); setAssignOpen(true); }}>
                        Assign Clearance
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-72">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search by employee or template..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>

                <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                >
                    <SelectTrigger className="w-44">
                        <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        {CLEARANCE_REQUEST_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                                {CLEARANCE_REQUEST_STATUS_LABELS[status]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {hasActiveFilters && (
                    <Button variant="outline" size="sm" onClick={resetFilters}>
                        <X className="mr-2 h-4 w-4" />
                        Clear
                    </Button>
                )}

                <p className="ml-auto text-sm text-muted-foreground" aria-live="polite">
                    Showing <span className="font-semibold">{filteredRequests.length}</span>{" "}
                    of <span className="font-semibold">{requests.length}</span> clearance{" "}
                    {filteredRequests.length === 1 ? "request" : "requests"}
                </p>
            </div>

            <ClearanceHubTable
                data={filteredRequests}
                resignations={resignations}
                selectedId={effectiveSelectedId}
                completionByRequest={completion.index}
                onRetry={handleRetry}
                onClearFilters={resetFilters}
                canClearFilters={hasActiveFilters}
                isLoading={isLoading}
                error={error}
            />

            <AssignClearanceDialog isOpen={assignOpen} onClose={() => setAssignOpen(false)} />
        </div>
    );
}
