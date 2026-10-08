"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Search, X } from "lucide-react";
import { useClearanceHubContext } from "../providers/ClearanceHubProvider";
import { ClearanceHubTable, type SortKey } from "./ClearanceHubTable";
import { AssignClearanceDialog } from "./AssignClearanceDialog";
import { DateRangePicker } from "./DateRangePicker";
import { useDocumentCompletionIndex } from "../hooks/useDocumentChecklist";
import { useDialogTriggerFocus } from "../hooks/useDialogTriggerFocus";
import type { ClearanceHubListQuery } from "../hooks/useClearanceHub";

const DEFAULT_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

function toServerSort(sortKey: SortKey, direction: "asc" | "desc"): string | undefined {
    if (sortKey !== "filed") return undefined;
    return direction === "asc" ? "created_at" : "-created_at";
}

export function ClearanceHubOverview() {
    const { requests, total, resignations, isLoading, error, refresh } = useClearanceHubContext();
    const completion = useDocumentCompletionIndex();
    const searchParams = useSearchParams();

    const [searchInput, setSearchInput] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [showCompleted, setShowCompleted] = useState(false);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [sortKey, setSortKey] = useState<SortKey>("employee");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
    const selectedId = useMemo(() => {
        const raw = searchParams.get("selected");
        if (raw === null) return null;
        const parsed = Number.parseInt(raw, 10);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }, [searchParams]);
    const [assignOpen, setAssignOpen] = useState(false);

    const captureAssignTrigger = useDialogTriggerFocus(assignOpen);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchInput.trim());
            setCurrentPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchInput]);

    useEffect(() => {
        const query: ClearanceHubListQuery = {
            page: currentPage,
            limit: pageSize,
            search: debouncedSearch === "" ? undefined : debouncedSearch,
            status: showCompleted ? undefined : "not_completed",
            dateFrom: dateFrom === "" ? undefined : dateFrom,
            dateTo: dateTo === "" ? undefined : dateTo,
        };
        const serverSort = toServerSort(sortKey, sortDirection);
        if (serverSort !== undefined) query.sort = serverSort;
        void refresh(query);
    }, [currentPage, pageSize, sortKey, sortDirection, debouncedSearch, showCompleted, dateFrom, dateTo, refresh]);

    const effectiveSelectedId =
        selectedId !== null && requests.some((request) => request.id === selectedId)
            ? selectedId
            : (requests.length > 0 ? requests[0].id : null);

    const handleRetry = async () => {
        await refresh();
        await completion.refresh();
    };

    const resetFilters = () => {
        setSearchInput("");
        setDebouncedSearch("");
        setShowCompleted(false);
        setDateFrom("");
        setDateTo("");
        setCurrentPage(1);
    };

    const handleSearchChange = (value: string) => {
        setSearchInput(value);
    };

    const handleShowCompletedChange = (checked: boolean) => {
        setShowCompleted(checked);
        setCurrentPage(1);
    };

    const handleSortChange = (key: SortKey, direction: "asc" | "desc") => {
        setSortKey(key);
        setSortDirection(direction);
        setCurrentPage(1);
    };

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setCurrentPage(1);
    };

    const handleDateRangeChange = (from: string, to: string) => {
        setDateFrom(from);
        setDateTo(to);
        setCurrentPage(1);
    };

    const hasActiveFilters = searchInput.trim() !== "" || dateFrom !== "" || dateTo !== "";

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-3xl font-bold tracking-tight">
                        Clearance Hub
                    </h1>
                    <p className="text-muted-foreground">
                        Assign and monitor resignation clearances
                    </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRetry}
                        disabled={isLoading}
                        className="min-h-11 w-full gap-2 sm:w-auto md:min-h-0"
                    >
                        Refresh
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => { captureAssignTrigger(); setAssignOpen(true); }}
                        className="min-h-11 w-full sm:w-auto md:min-h-0"
                    >
                        Assign Clearance
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-72">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search by employee or template..."
                        value={searchInput}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-10"
                    />
                </div>

                <DateRangePicker
                    from={dateFrom}
                    to={dateTo}
                    onChange={handleDateRangeChange}
                />

                {hasActiveFilters && (
                    <Button variant="outline" size="sm" onClick={resetFilters}>
                        <X className="mr-2 h-4 w-4" />
                        Clear
                    </Button>
                )}

                <p className="ml-auto text-sm text-muted-foreground" aria-live="polite">
                    Showing <span className="font-semibold">{requests.length}</span>{" "}
                    of <span className="font-semibold">{total}</span> clearance{" "}
                    {total === 1 ? "request" : "requests"}
                </p>

                <div className="flex min-h-11 items-center gap-2">
                    <Switch
                        id="hub-show-completed"
                        checked={showCompleted}
                        onCheckedChange={handleShowCompletedChange}
                    />
                    <Label htmlFor="hub-show-completed" className="cursor-pointer">
                        Show completed
                    </Label>
                </div>
            </div>

            <ClearanceHubTable
                data={requests}
                resignations={resignations}
                selectedId={effectiveSelectedId}
                completionByRequest={completion.index}
                onRetry={handleRetry}
                onClearFilters={resetFilters}
                canClearFilters={hasActiveFilters}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                isLoading={isLoading}
                error={error}
                total={total}
                pageSize={pageSize}
                onPageSizeChange={handlePageSizeChange}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSortChange={handleSortChange}
            />

            <AssignClearanceDialog isOpen={assignOpen} onClose={() => setAssignOpen(false)} />
        </div>
    );
}
