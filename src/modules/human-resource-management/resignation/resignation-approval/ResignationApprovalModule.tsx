"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPHT } from "@/modules/human-resource-management/shared/utils/time";
import {
    ResignationApprovalProvider,
    useResignationApprovalContext,
} from "./providers/ResignationApprovalProvider";
import { ResignationApprovalTable } from "./components/ResignationApprovalTable";

function ResignationApprovalContent() {
    const { requests, isLoading, error, refresh, approveRequest, rejectRequest } =
        useResignationApprovalContext();

    const [searchQuery, setSearchQuery] = useState("");
    const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
    const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
    const [nameFilter, setNameFilter] = useState<string | null>(null);

    const handleApprove = async (id: number, remarks: string) => {
        try {
            const message = await approveRequest(id, remarks);
            toast.success(message);
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : "Failed to approve resignation request";
            toast.error(errorMessage);
            throw err;
        }
    };

    const handleReject = async (id: number, remarks: string) => {
        try {
            const message = await rejectRequest(id, remarks);
            toast.success(message);
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : "Failed to reject resignation request";
            toast.error(errorMessage);
            throw err;
        }
    };

    const handleRetry = async () => {
        await refresh();
    };

    const resetFilters = () => {
        setSearchQuery("");
        setDateFrom(undefined);
        setDateTo(undefined);
        setNameFilter(null);
    };

    const employeeNames = useMemo(() => {
        const names = requests.map((req) => {
            return [req.user_fname, req.user_mname, req.user_lname]
                .filter(Boolean)
                .join(" ");
        });
        return Array.from(new Set(names)).sort();
    }, [requests]);

    const filteredRequests = useMemo(() => {
        let filtered = [...requests];

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter((req) => {
                const fullName = [req.user_fname, req.user_mname, req.user_lname]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();
                return (
                    fullName.includes(query) ||
                    req.reason?.toLowerCase().includes(query)
                );
            });
        }

        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            filtered = filtered.filter((req) => {
                const reqDate = new Date(req.filed_at);
                return reqDate >= fromDate;
            });
        }

        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter((req) => {
                const reqDate = new Date(req.filed_at);
                return reqDate <= toDate;
            });
        }

        if (nameFilter !== null) {
            filtered = filtered.filter((req) => {
                const fullName = [req.user_fname, req.user_mname, req.user_lname]
                    .filter(Boolean)
                    .join(" ");
                return fullName === nameFilter;
            });
        }

        return filtered;
    }, [requests, searchQuery, dateFrom, dateTo, nameFilter]);

    const hasActiveFilters =
        searchQuery ||
        dateFrom ||
        dateTo ||
        nameFilter !== null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Resignation Approval
                    </h1>
                    <p className="text-muted-foreground">
                        Review pending resignation requests
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    disabled={isLoading}
                    className="gap-2"
                >
                    Refresh
                </Button>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative w-62.5">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by employee name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-[140px] justify-start text-left font-normal",
                                        !dateFrom && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                    {dateFrom ? (
                                        <span className="truncate">
                                            {formatPHT(dateFrom, { includeTime: false })}
                                        </span>
                                    ) : (
                                        <span>From date</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={dateFrom}
                                    onSelect={setDateFrom}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-[140px] justify-start text-left font-normal",
                                        !dateTo && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                    {dateTo ? (
                                        <span className="truncate">
                                            {formatPHT(dateTo, { includeTime: false })}
                                        </span>
                                    ) : (
                                        <span>To date</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={dateTo}
                                    onSelect={setDateTo}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>

                        <Select
                            value={nameFilter !== null ? nameFilter : "all"}
                            onValueChange={(value) =>
                                setNameFilter(value === "all" ? null : value)
                            }
                        >
                            <SelectTrigger className="w-42.5">
                                <SelectValue placeholder="All Employees" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Employees</SelectItem>
                                {employeeNames.map((name) => (
                                    <SelectItem key={name} value={name}>
                                        {name}
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
                    </div>
                </CardContent>
            </Card>

            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    Showing <span className="font-semibold">{filteredRequests.length}</span>{" "}
                    of <span className="font-semibold">{requests.length}</span> resignation{" "}
                    {requests.length === 1 ? "request" : "requests"}
                </p>
            </div>

            <ResignationApprovalTable
                data={filteredRequests}
                onApprove={handleApprove}
                onReject={handleReject}
                onRetry={handleRetry}
                isLoading={isLoading}
                error={error}
            />
        </div>
    );
}

export default function ResignationApprovalModule() {
    return (
        <ResignationApprovalProvider>
            <ResignationApprovalContent />
        </ResignationApprovalProvider>
    );
}
