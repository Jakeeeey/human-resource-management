"use client";

import React from "react";
import { format } from "date-fns";
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
import { Edit2, Trash2, FileText } from "lucide-react";
import type { ServiceRecordEntry } from "../type";

interface ServiceRecordTableProps {
  records: ServiceRecordEntry[];
  isStillInService: boolean;
  onEditEntry: (entry: ServiceRecordEntry) => void;
  onDeleteEntry: (entryId: number) => void;
  isLoading?: boolean;
}

export function ServiceRecordTable({
  records,
  isStillInService,
  onEditEntry,
  onDeleteEntry,
  isLoading,
}: ServiceRecordTableProps) {
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "--";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return format(d, "MM/dd/yy");
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  if (records.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-2xl bg-card/40">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
          <FileText className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-foreground">No Service Records Found</h3>
        <p className="text-xs text-muted-foreground max-w-sm mt-1">
          This employee has no recorded appointments or step increments yet. Click &quot;Add Appointment / Step Entry&quot; to begin.
        </p>
      </div>
    );
  }

  // Sort ascending by service_from, sequence_order
  const sortedRecords = [...records].sort((a, b) => {
    const dComp = new Date(a.service_from).getTime() - new Date(b.service_from).getTime();
    if (dComp !== 0) return dComp;
    return (a.sequence_order || 0) - (b.sequence_order || 0);
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-background/50 overflow-hidden shadow-xs">
        <Table>
          <TableHeader className="bg-muted/40">
            {/* Super Headers */}
            <TableRow className="border-b border-border/60 hover:bg-transparent">
              <TableHead colSpan={2} className="text-center font-bold text-xs uppercase tracking-wider border-r border-border/40 py-2.5">
                Services
              </TableHead>
              <TableHead colSpan={3} className="text-center font-bold text-xs uppercase tracking-wider border-r border-border/40 py-2.5">
                Record of Appointment
              </TableHead>
              <TableHead className="text-center font-bold text-xs uppercase tracking-wider border-r border-border/40 py-2.5">
                Station / Assignment
              </TableHead>
              <TableHead className="text-center font-bold text-xs uppercase tracking-wider border-r border-border/40 py-2.5">
                Branch
              </TableHead>
              <TableHead className="text-center font-bold text-xs uppercase tracking-wider border-r border-border/40 py-2.5">
                L/Abs. w/o Pay
              </TableHead>
              <TableHead className="text-center font-bold text-xs uppercase tracking-wider border-r border-border/40 py-2.5">
                Cause
              </TableHead>
              <TableHead className="text-center font-bold text-xs uppercase tracking-wider py-2.5 w-20">
                Actions
              </TableHead>
            </TableRow>

            {/* Sub Headers */}
            <TableRow className="border-b border-border/60 bg-muted/20 hover:bg-transparent text-[11px] font-bold">
              <TableHead className="text-center py-2 text-[10px] uppercase font-bold text-muted-foreground w-20">From</TableHead>
              <TableHead className="text-center py-2 text-[10px] uppercase font-bold text-muted-foreground w-20 border-r border-border/40">To</TableHead>
              <TableHead className="text-center py-2 text-[10px] uppercase font-bold text-muted-foreground">Designation</TableHead>
              <TableHead className="text-center py-2 text-[10px] uppercase font-bold text-muted-foreground">Status</TableHead>
              <TableHead className="text-center py-2 text-[10px] uppercase font-bold text-muted-foreground border-r border-border/40">Salary</TableHead>
              <TableHead className="text-center py-2 text-[10px] uppercase font-bold text-muted-foreground border-r border-border/40">Station</TableHead>
              <TableHead className="text-center py-2 text-[10px] uppercase font-bold text-muted-foreground border-r border-border/40">Branch</TableHead>
              <TableHead className="text-center py-2 text-[10px] uppercase font-bold text-muted-foreground border-r border-border/40">Leave</TableHead>
              <TableHead className="text-center py-2 text-[10px] uppercase font-bold text-muted-foreground border-r border-border/40">Cause</TableHead>
              <TableHead className="text-center py-2 text-[10px] uppercase font-bold text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {sortedRecords.map((row, idx) => {
              const isLastRow = idx === sortedRecords.length - 1;
              const isPresentRow = isLastRow && isStillInService && (!row.service_to || row.service_to.trim() === "");

              return (
                <TableRow key={row.service_record_id} className="hover:bg-primary/[0.03] transition-colors border-b border-border/30 text-xs">
                  {/* From */}
                  <TableCell className="text-center font-mono font-medium py-3">
                    {formatDate(row.service_from)}
                  </TableCell>

                  {/* To */}
                  <TableCell className="text-center font-mono font-medium py-3 border-r border-border/40">
                    {isPresentRow ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold px-2 py-0">
                        Present
                      </Badge>
                    ) : (
                      formatDate(row.service_to)
                    )}
                  </TableCell>

                  {/* Designation */}
                  <TableCell className="text-center font-bold text-foreground py-3">
                    {row.designation}
                  </TableCell>

                  {/* Appointment Status */}
                  <TableCell className="text-center py-3">
                    <span className="font-medium text-foreground">{row.appointment_status}</span>
                  </TableCell>

                  {/* Salary */}
                  <TableCell className="text-right font-mono font-bold text-foreground py-3 border-r border-border/40 pr-4">
                    ₱{formatCurrency(row.salary)}
                  </TableCell>

                  {/* Station */}
                  <TableCell className="text-center py-3 border-r border-border/40 font-medium">
                    {row.station_assignment}
                  </TableCell>

                  {/* Branch */}
                  <TableCell className="text-center py-3 border-r border-border/40 text-muted-foreground">
                    {row.branch}
                  </TableCell>

                  {/* L/Abs w/o pay */}
                  <TableCell className="text-center py-3 border-r border-border/40 text-muted-foreground">
                    {row.leave_wo_pay || "None"}
                  </TableCell>

                  {/* Cause */}
                  <TableCell className="text-center py-3 border-r border-border/40">
                    <Badge variant="outline" className="text-[10px] font-bold">
                      {row.cause}
                    </Badge>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-center py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onEditEntry(row)}
                        className="h-7 w-7 rounded-lg text-primary hover:bg-primary/10"
                        title="Edit entry"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onDeleteEntry(row.service_record_id)}
                        className="h-7 w-7 rounded-lg text-rose-500 hover:bg-rose-500/10"
                        title="Delete entry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* (STILL IN THE SERVICE) Banner */}
      {isStillInService && (
        <div className="py-2.5 px-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center justify-center text-center">
          <span className="text-xs font-black tracking-widest uppercase text-emerald-600 dark:text-emerald-400">
            ( S T I L L   I N   T H E   S E R V I C E )
          </span>
        </div>
      )}
    </div>
  );
}
