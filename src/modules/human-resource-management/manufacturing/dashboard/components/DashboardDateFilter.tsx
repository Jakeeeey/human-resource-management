/* eslint-disable */
import React from "react";
import { Calendar, GitBranch } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DashboardFiltersProps {
    startDate: string;
    endDate: string;
    lineId?: string;
    lines: any[];
    onChange: (type: "startDate" | "endDate" | "lineId", value: string) => void;
}

export function DashboardDateFilter({ startDate, endDate, lineId, lines, onChange }: DashboardFiltersProps) {
    return (
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-2 px-4 rounded-xl border shadow-sm w-full sm:w-auto">
            <div className="flex items-center gap-3 w-full sm:w-auto border-r border-border pr-4 mr-1">
                <GitBranch className="h-4 w-4 text-muted-foreground hidden sm:block" />
                <Select value={lineId || "all"} onValueChange={(val) => onChange("lineId", val)}>
                    <SelectTrigger className="w-full sm:w-[160px] h-9 border-muted-foreground/20 text-sm font-medium">
                        <SelectValue placeholder="All Lines" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Lines</SelectItem>
                        {lines?.map((line) => (
                            <SelectItem key={line.id} value={String(line.id)}>
                                {line.line_name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground mr-2 hidden sm:flex">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium uppercase tracking-wider">Date</span>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Label htmlFor="start_date" className="sr-only">Start Date</Label>
                    <Input 
                        id="start_date"
                        type="date" 
                        value={startDate} 
                        onChange={(e) => onChange("startDate", e.target.value)}
                        className="h-9 w-full sm:w-[140px] text-sm font-medium border-muted-foreground/20"
                    />
                </div>
                <span className="text-muted-foreground/50 font-medium">to</span>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Label htmlFor="end_date" className="sr-only">End Date</Label>
                    <Input 
                        id="end_date"
                        type="date" 
                        value={endDate} 
                        onChange={(e) => onChange("endDate", e.target.value)}
                        className="h-9 w-full sm:w-[140px] text-sm font-medium border-muted-foreground/20"
                    />
                </div>
            </div>
        </div>
    );
}
