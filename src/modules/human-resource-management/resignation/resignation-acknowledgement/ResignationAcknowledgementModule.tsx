"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPHT } from "./utils/time";
import {
    ResignationAcknowledgementProvider,
    useResignationAcknowledgementContext,
} from "./providers/ResignationAcknowledgementProvider";
import { ResignationAcknowledgementTable } from "./components/ResignationAcknowledgementTable";

function ResignationAcknowledgementContent() {
    const {
        requests,
        isLoading,
        error,
        refresh,
        acknowledgeRequest,
        withdrawRequest,
        includeInactive,
        setIncludeInactive,
    } = useResignationAcknowledgementContext();

    const [searchQuery, setSearchQuery] = useState("");
    const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
    const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

    const handleAcknowledge = async (id: number, remarks: string) => {
        try {
            const message = await acknowledgeRequest(id, remarks);
            toast.success(message);
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : "Failed to acknowledge resignation request";
            toast.error(errorMessage);
            throw err;
        }
    };

    const handleWithdraw = async (id: number, remarks: string) => {
        try {
            const message = await withdrawRequest(id, remarks);
            toast.success(message);
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : "Failed to withdraw resignation request";
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
    };

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

        return filtered;
    }, [requests, searchQuery, dateFrom, dateTo]);

    const hasActiveFilters =
        searchQuery.trim() !== "" || dateFrom !== undefined || dateTo !== undefined;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Resignation Acknowledgement
                    </h1>
                    <p className="text-muted-foreground">
                        Acknowledge and track resignation notices
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

                        {hasActiveFilters && (
                            <Button variant="outline" size="sm" onClick={resetFilters}>
                                <X className="mr-2 h-4 w-4" />
                                Clear
                            </Button>
                        )}

                        <div className="ml-auto flex items-center gap-2">
                            <Label htmlFor="include-inactive">
                                Show non-active resignations
                            </Label>
                            <Switch
                                id="include-inactive"
                                checked={includeInactive}
                                onCheckedChange={setIncludeInactive}
                            />
                        </div>
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

            <ResignationAcknowledgementTable
                data={filteredRequests}
                onAcknowledge={handleAcknowledge}
                onWithdraw={handleWithdraw}
                onRetry={handleRetry}
                isLoading={isLoading}
                error={error}
                includeInactive={includeInactive}
            />
        </div>
    );
}

export default function ResignationAcknowledgementModule() {
    return (
        <ResignationAcknowledgementProvider>
            <ResignationAcknowledgementContent />
        </ResignationAcknowledgementProvider>
    );
}
