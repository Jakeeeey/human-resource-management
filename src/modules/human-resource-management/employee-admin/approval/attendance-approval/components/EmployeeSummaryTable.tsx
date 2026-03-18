"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, ChevronRight, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";

export interface EmployeeSummary {
  user_id: number;
  user_fname: string;
  user_lname: string;
  department_name: string | null;
  total_work_minutes: number;
  total_late_minutes: number;
  total_undertime_minutes: number;
  total_overtime_minutes: number;
  days_count: number;
}

interface EmployeeSummaryTableProps {
  data: EmployeeSummary[];
  onViewDetails: (userId: number) => void;
  isLoading: boolean;
  isProcessing?: boolean;
}

export function EmployeeSummaryTable({
  data,
  onViewDetails,
  isLoading,
  isProcessing,
}: EmployeeSummaryTableProps) {
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <span className="text-sm font-medium text-muted-foreground">Loading summaries...</span>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState 
        icon={ClipboardList}
        title="No Summaries Available"
        description="There are no employee summaries to show for this cutoff period. Ensure that attendance logs exist for the selected date range."
        className="bg-card/50 rounded-2xl border border-dashed border-primary/20 shadow-inner"
      />
    );
  }

  return (
    <div className="rounded-2xl border bg-background/50 overflow-hidden ring-1 ring-muted/10 shadow-xl shadow-foreground/5 transition-all duration-300">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent border-b-muted/20">
            <TableHead className="h-14 px-6 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Employee</TableHead>
            <TableHead className="h-14 px-6 font-bold text-muted-foreground uppercase tracking-widest text-[10px] text-center">Days</TableHead>
            <TableHead className="h-14 px-6 font-bold text-muted-foreground uppercase tracking-widest text-[10px] text-center">Work (Total)</TableHead>
            <TableHead className="h-14 px-6 font-bold text-muted-foreground uppercase tracking-widest text-[10px] text-center">Late (Total)</TableHead>
            <TableHead className="h-14 px-6 font-bold text-muted-foreground uppercase tracking-widest text-[10px] text-center">Undertime</TableHead>
            <TableHead className="h-14 px-6 font-bold text-muted-foreground uppercase tracking-widest text-[10px] text-center">Overtime</TableHead>
            <TableHead className="h-14 px-6 font-bold text-muted-foreground uppercase tracking-widest text-[10px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((summary) => (
            <TableRow 
              key={summary.user_id} 
              className="hover:bg-primary/[0.03] transition-colors border-b-muted/10 group h-16"
            >
              <TableCell className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                     <span className="text-xs font-bold text-primary">
                        {summary.user_fname?.[0]}{summary.user_lname?.[0]}
                     </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground text-sm leading-tight">
                      {summary.user_fname} {summary.user_lname}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                      <span className="opacity-60">ID:</span>
                      <span className="text-primary/80 font-bold">{summary.user_id}</span>
                      <span className="mx-1 opacity-20">|</span>
                      <span>{summary.department_name || "No Department"}</span>
                    </span>
                  </div>
                </div>
              </TableCell>

              <TableCell className="px-6 py-4 text-center">
                <Badge variant="outline" className="rounded-lg font-bold bg-background/50 border-muted/20">
                  {summary.days_count} Days
                </Badge>
              </TableCell>

              <TableCell className="px-6 py-4 text-center">
                <div className="flex flex-col items-center">
                  <span className="text-sm font-bold text-foreground">{summary.total_work_minutes}</span>
                  <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">mins</span>
                </div>
              </TableCell>

              <TableCell className="px-6 py-4 text-center">
                <div className="flex flex-col items-center">
                  <span className={cn(
                    "text-sm font-bold",
                    summary.total_late_minutes > 0 ? "text-red-500" : "text-muted-foreground/40"
                  )}>
                    {summary.total_late_minutes}
                  </span>
                  <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">mins</span>
                </div>
              </TableCell>

              <TableCell className="px-6 py-4 text-center">
                <div className="flex flex-col items-center">
                  <span className={cn(
                    "text-sm font-bold",
                    summary.total_undertime_minutes > 0 ? "text-orange-500" : "text-muted-foreground/40"
                  )}>
                    {summary.total_undertime_minutes}
                  </span>
                  <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">mins</span>
                </div>
              </TableCell>

              <TableCell className="px-6 py-4 text-center">
                <div className="flex flex-col items-center">
                  <span className={cn(
                    "text-sm font-bold",
                    summary.total_overtime_minutes > 0 ? "text-green-500" : "text-muted-foreground/40"
                  )}>
                    {summary.total_overtime_minutes}
                  </span>
                  <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">mins</span>
                </div>
              </TableCell>

              <TableCell className="px-6 py-4 text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-xl h-9 px-4 gap-2 text-primary hover:bg-primary/10 transition-all active:scale-95 border border-transparent hover:border-primary/20"
                    onClick={() => onViewDetails(summary.user_id)}
                    disabled={isProcessing}
                  >
                    <Eye className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-tight">
                      {isProcessing ? "Processing..." : "View Details"}
                    </span>
                    <ChevronRight className="h-3 w-3 opacity-50" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
