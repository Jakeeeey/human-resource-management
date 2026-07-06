"use client";

import { useState, useEffect, useCallback } from "react";
import { useLogisticsPayrollContext } from "../providers/LogisticsPayrollProvider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, setDate } from "date-fns";

export function LogisticsPayrollHeader() {
    const { setCutoffFilters } = useLogisticsPayrollContext();
    
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
            start = setDate(date, 26);
            // 26-10 goes to the 10th of the next month
            const nextMonth = new Date(year, month + 1, 1);
            end = setDate(nextMonth, 10);
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
    };

    return (
        <div className="flex flex-col md:flex-row items-center gap-4 mb-6 p-4 bg-white rounded-lg shadow-sm border border-slate-200">
            <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">Month</span>
                <input 
                    type="month" 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
            </div>

            <div className="flex flex-col gap-2 min-w-[200px]">
                <span className="text-sm font-medium text-slate-700">Cutoff Period</span>
                <Select value={selectedCutoff} onValueChange={(val: "11-25" | "26-10") => setSelectedCutoff(val)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select Cutoff" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="11-25">11th to 25th</SelectItem>
                        <SelectItem value="26-10">26th to 10th</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-row items-end gap-2 h-full mt-auto mb-[2px]">
                <Button onClick={handleApplyFilter} className="bg-blue-600 hover:bg-blue-700 text-white">
                    Apply Filter
                </Button>
                <Button variant="outline" onClick={handleClearFilter}>
                    Clear
                </Button>
            </div>
        </div>
    );
}
