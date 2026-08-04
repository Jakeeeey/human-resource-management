"use client";

import { useState, useEffect, useCallback } from "react";
import { useLogisticsPayrollContext } from "../providers/LogisticsPayrollProvider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, setDate } from "date-fns";
import { Search, Calendar, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";

export function LogisticsPayrollHeader() {
    const { setCutoffFilters, searchQuery, setSearchQuery, showPendingOnly, setShowPendingOnly } = useLogisticsPayrollContext();
    
    const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));
    const [selectedCutoff, setSelectedCutoff] = useState<"11-25" | "26-10">("11-25");

    const handleApplyFilter = useCallback(() => {
        const [yearStr, monthStr] = selectedMonth.split("-");
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10) - 1; // 0-indexed

        const date = new Date(year, month, 1);

        let start: Date;
        let end: Date;

        if (selectedCutoff === "11-25") {
            start = setDate(date, 11);
            end = setDate(date, 25);
        } else {
            // 26-10: 26th of previous month to 10th of selected month
            const prevMonth = new Date(year, month - 1, 1);
            start = setDate(prevMonth, 26);
            end = setDate(date, 10);
        }

        const startStr = format(start, "yyyy-MM-dd");
        const endStr = format(end, "yyyy-MM-dd");

        setCutoffFilters(startStr, endStr);
    }, [selectedMonth, selectedCutoff, setCutoffFilters]);

    // Initial filter on mount
    useEffect(() => {
        handleApplyFilter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleClearFilter = () => {
        setCutoffFilters(undefined, undefined);
        setSearchQuery("");
    };

    return (
        <div className="flex flex-col gap-4 mb-6 p-5 bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Filter className="w-5 h-5 text-blue-600" />
                    Filter & Search
                </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                {/* Search */}
                <div className="col-span-1 md:col-span-4 flex flex-col gap-2">
                    <span className="text-sm font-medium text-slate-700">Search Personnel</span>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Search by name or ID..." 
                            className="pl-9 h-10 w-full bg-slate-50 border-slate-200 focus:bg-white"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Month */}
                <div className="col-span-1 md:col-span-3 flex flex-col gap-2">
                    <span className="text-sm font-medium text-slate-700">Month</span>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input 
                            type="month" 
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="flex h-10 w-full pl-9 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors focus:bg-white"
                        />
                    </div>
                </div>

                {/* Cutoff */}
                <div className="col-span-1 md:col-span-3 flex flex-col gap-2">
                    <span className="text-sm font-medium text-slate-700">Cutoff Period</span>
                    <Select value={selectedCutoff} onValueChange={(val: "11-25" | "26-10") => setSelectedCutoff(val)}>
                        <SelectTrigger className="h-10 bg-slate-50 border-slate-200 focus:bg-white">
                            <SelectValue placeholder="Select Cutoff" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="11-25">11th to 25th</SelectItem>
                            <SelectItem value="26-10">26th to 10th</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Actions */}
                <div className="col-span-1 md:col-span-2 flex flex-col gap-2">
                    <span className="text-sm font-medium text-slate-700 hidden md:block">&nbsp;</span>
                    <div className="flex flex-row gap-2 h-10 mt-2 md:mt-0">
                        <Button onClick={handleApplyFilter} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all px-2">
                            Apply
                        </Button>
                        <Button variant="outline" onClick={handleClearFilter} className="flex-1 border-slate-200 hover:bg-slate-100 text-slate-700 px-2">
                            Clear
                        </Button>
                    </div>
                </div>

                {/* Show Pending Only Toggle */}
                <div className="col-span-1 md:col-span-12 flex items-center justify-end mt-2 pt-2 border-t border-slate-100">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={showPendingOnly}
                            onChange={(e) => setShowPendingOnly(e.target.checked)}
                        />
                        <span className="text-sm font-medium text-slate-700">Show Pending Only</span>
                    </label>
                </div>
            </div>
        </div>
    );
}
