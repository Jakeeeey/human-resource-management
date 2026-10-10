"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import type { AttendanceLogWithUser } from "../type";
import { ApprovalModal } from "./ApprovalModal";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Check, X, Loader2, Save, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";
import { Badge } from "@/components/ui/badge";

import { Checkbox } from "@/components/ui/checkbox";

interface AttendanceTableProps {
  data: AttendanceLogWithUser[];
  onApprove: (log: AttendanceLogWithUser, remarks: string) => Promise<void>;
  onReject: (log: AttendanceLogWithUser, remarks: string) => Promise<void>;
  onUpdateRow: (logId: number, field: string, value: string | number | null) => void;
  onSaveRow: (log: AttendanceLogWithUser) => Promise<void>;
  onBatchApprove?: (logs: AttendanceLogWithUser[]) => Promise<void>;
  onBatchReject?: (logs: AttendanceLogWithUser[]) => Promise<void>;
  isLoading: boolean;
  isProcessing?: boolean;
}

export function AttendanceTable({
  data,
  onApprove,
  onReject,
  onUpdateRow,
  onSaveRow,
  onBatchApprove,
  onBatchReject,
  isLoading,
  isProcessing = false,
}: AttendanceTableProps) {
  const [selectedLog, setSelectedLog] = useState<AttendanceLogWithUser | null>(null);
  const [modalMode, setModalMode] = useState<"approve" | "reject" | null>(null);
  const [savingLogId, setSavingLogId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const handleOpenModal = (log: AttendanceLogWithUser, mode: "approve" | "reject") => {
    setSelectedLog(log);
    setModalMode(mode);
  };

  const handleCloseModal = () => {
    setSelectedLog(null);
    setModalMode(null);
  };

  const handleConfirm = async (remarks: string) => {
    if (!selectedLog || !modalMode) return;

    if (modalMode === "approve") {
      await onApprove(selectedLog, remarks);
    } else {
      await onReject(selectedLog, remarks);
    }
  };

  const handleLocalSave = async (log: AttendanceLogWithUser) => {
    try {
      setSavingLogId(log.log_id);
      await onSaveRow(log);
    } finally {
      setSavingLogId(null);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === data.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.map(log => log.log_id)));
    }
  };

  const toggleSelectRow = (logId: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(logId)) {
      newSelected.delete(logId);
    } else {
      newSelected.add(logId);
    }
    setSelectedIds(newSelected);
  };

  const handleBatchApproveClick = async () => {
    if (!onBatchApprove) return;
    const selectedLogs = data.filter(log => selectedIds.has(log.log_id));
    await onBatchApprove(selectedLogs);
    setSelectedIds(new Set());
  };

  const handleBatchRejectClick = async () => {
    if (!onBatchReject) return;
    const selectedLogs = data.filter(log => selectedIds.has(log.log_id));
    await onBatchReject(selectedLogs);
    setSelectedIds(new Set());
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState 
        icon={CalendarCheck}
        title="No Attendance Logs"
        description="We couldn't find any attendance logs for the selected criteria. Try adjusting your filters or checking a different date."
        className="bg-card/50 rounded-2xl border border-dashed border-primary/20 shadow-inner"
      />
    );
  }

  return (
    <div className="space-y-4">
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-primary/5 p-4 rounded-2xl border border-primary/10 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-bold px-3 py-1">
              {selectedIds.size} Selected
            </Badge>
            <span className="text-sm font-semibold text-muted-foreground italic">
              Batch actions only affect rows with appropriate status
            </span>
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              onClick={handleBatchApproveClick}
              disabled={isProcessing}
              className="bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl h-9 px-4 gap-2 shadow-lg shadow-green-500/20 active:scale-95 transition-all"
            >
              <Check className="h-4 w-4" />
              Approve Selected
            </Button>
            <Button 
              size="sm" 
              variant="destructive"
              onClick={handleBatchRejectClick}
              disabled={isProcessing}
              className="bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl h-9 px-4 gap-2 shadow-lg shadow-red-500/20 active:scale-95 transition-all"
            >
              <X className="h-4 w-4" />
              Reject Selected
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-background/50 overflow-hidden ring-1 ring-muted/10 shadow-xl shadow-foreground/5 transition-all duration-300">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-b-muted/20 h-10">
              <TableHead className="w-10 px-4 text-center">
                <Checkbox 
                  checked={selectedIds.size === data.length && data.length > 0}
                  onCheckedChange={toggleSelectAll}
                  className="rounded-md border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all shadow-sm"
                />
              </TableHead>
              <TableHead className="h-9 px-3 font-bold text-muted-foreground uppercase tracking-widest text-[8px]">Employee</TableHead>
              <TableHead className="h-9 px-2 font-bold text-muted-foreground uppercase tracking-widest text-[8px] text-center">Work</TableHead>
              <TableHead className="h-9 px-2 font-bold text-muted-foreground uppercase tracking-widest text-[8px] text-center">Late</TableHead>
              <TableHead className="h-9 px-2 font-bold text-muted-foreground uppercase tracking-widest text-[8px] text-center">Undertime</TableHead>
              <TableHead className="h-9 px-2 font-bold text-muted-foreground uppercase tracking-widest text-[8px] text-center">Overtime</TableHead>
              <TableHead className="h-9 px-2 font-bold text-muted-foreground uppercase tracking-widest text-[8px] text-center">Status</TableHead>
              <TableHead className="h-9 px-3 font-bold text-muted-foreground uppercase tracking-widest text-[8px] text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((log) => (
              <TableRow 
                key={log.log_id} 
                className={cn(
                  "hover:bg-primary/[0.03] transition-colors border-b border-muted/15 group",
                  selectedIds.has(log.log_id) && "bg-primary/[0.02]"
                )}
              >
                <TableCell className="px-4 text-center align-middle">
                  <Checkbox 
                    checked={selectedIds.has(log.log_id)}
                    onCheckedChange={() => toggleSelectRow(log.log_id)}
                    className="rounded-md border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all shadow-sm"
                  />
                </TableCell>
                <TableCell className="px-3 py-2.5 align-middle">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                      <span className="text-xs font-bold text-primary">
                          {log.user_fname?.[0]}{log.user_lname?.[0]}
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-foreground text-sm leading-tight truncate">
                          {log.user_fname} {log.user_lname}
                        </span>
                        {log.ot_request && (
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-tight border shadow-xs transition-all cursor-help whitespace-nowrap",
                              log.ot_request.status.toLowerCase() === "approved"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                : log.ot_request.status.toLowerCase() === "pending"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                            )}
                            title={log.ot_request.purpose ? `OT Purpose: ${log.ot_request.purpose}` : `OT Status: ${log.ot_request.status}`}
                          >
                            OT: {log.ot_request.status.charAt(0).toUpperCase() + log.ot_request.status.slice(1).toLowerCase()}
                            {log.ot_request.duration_minutes ? ` (${log.ot_request.duration_minutes}m)` : ""}
                          </span>
                        )}
                        {log.ut_request && (
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-tight border shadow-xs transition-all cursor-help whitespace-nowrap",
                              log.ut_request.status.toLowerCase() === "approved"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                : log.ut_request.status.toLowerCase() === "pending"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                            )}
                            title={log.ut_request.reason ? `UT Reason: ${log.ut_request.reason}` : `UT Status: ${log.ut_request.status}`}
                          >
                            UT: {log.ut_request.status.charAt(0).toUpperCase() + log.ut_request.status.slice(1).toLowerCase()}
                            {log.ut_request.duration_minutes ? ` (${log.ut_request.duration_minutes}m)` : ""}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                        <span className="opacity-60">ID:</span>
                        <span className="text-primary/80 font-bold">{log.user_id}</span>
                        <span className="mx-1 opacity-20">|</span>
                        <span>{format(new Date(log.log_date), "MMM dd, yyyy")}</span>
                      </span>
                      <div className="mt-1 flex items-center gap-1.5 text-[9px] font-mono">
                        <span className="font-bold text-muted-foreground/60 uppercase">Sched:</span>
                        <span className="font-bold text-muted-foreground/80">
                          {log.sched_time_in || "--:--"} - {log.sched_time_out || "--:--"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] font-mono">
                        <span className="font-bold text-primary/60 uppercase">Actual:</span>
                        <span className={cn("font-bold", log.time_in ? "text-primary" : "text-muted-foreground/60")}>
                          {log.time_in ? format(new Date(log.time_in), "hh:mm a") : "--:--"} - {log.time_out ? format(new Date(log.time_out), "hh:mm a") : "--:--"}
                        </span>
                      </div>
                    </div>
                  </div>
                </TableCell>

                <TableCell className="px-2 py-2 text-center align-middle">
                  <div className="flex flex-col items-center justify-center w-16 mx-auto">
                    <Input 
                      type="number"
                      value={log.work_minutes || 0}
                      onChange={(e) => onUpdateRow(log.log_id, "work_minutes", parseInt(e.target.value) || 0)}
                      className={cn(
                        "h-7 text-[11px] font-bold bg-background/50 border-muted/20 focus:border-primary/30 text-center px-1 rounded-lg",
                        (log.work_minutes || 0) > 0 ? "text-foreground" : "text-muted-foreground/40"
                      )}
                    />
                    <span className="text-[8px] text-muted-foreground uppercase font-semibold tracking-tighter text-center mt-0.5">mins</span>
                  </div>
                </TableCell>

                <TableCell className="px-2 py-2 text-center align-middle">
                  <div className="flex flex-col items-center justify-center w-16 mx-auto">
                    <Input 
                      type="number"
                      value={log.late_minutes || 0}
                      onChange={(e) => onUpdateRow(log.log_id, "late_minutes", parseInt(e.target.value) || 0)}
                      className={cn(
                        "h-7 text-[11px] font-bold bg-background/50 border-muted/20 focus:border-red-400 text-center px-1 rounded-lg",
                        log.late_minutes > 0 ? "text-red-500 font-extrabold" : "text-muted-foreground/40"
                      )}
                    />
                    <span className="text-[8px] text-muted-foreground uppercase font-semibold tracking-tighter text-center mt-0.5">mins</span>
                  </div>
                </TableCell>

                <TableCell className="px-2 py-2 text-center align-middle">
                  <div className="flex flex-col items-center justify-center w-16 mx-auto">
                    <Input 
                      type="number"
                      value={log.undertime_minutes || 0}
                      onChange={(e) => onUpdateRow(log.log_id, "undertime_minutes", parseInt(e.target.value) || 0)}
                      className={cn(
                        "h-7 text-[11px] font-bold bg-background/50 border-muted/20 focus:border-orange-400 text-center px-1 rounded-lg",
                        log.undertime_minutes > 0 ? "text-orange-500 font-extrabold" : "text-muted-foreground/40"
                      )}
                    />
                    <span className="text-[8px] text-muted-foreground uppercase font-semibold tracking-tighter text-center mt-0.5">mins</span>
                  </div>
                </TableCell>

                <TableCell className="px-2 py-2 text-center align-middle">
                  <div className="flex flex-col items-center justify-center w-16 mx-auto">
                    <Input 
                      type="number"
                      value={log.overtime_minutes || 0}
                      onChange={(e) => onUpdateRow(log.log_id, "overtime_minutes", parseInt(e.target.value) || 0)}
                      className={cn(
                        "h-7 text-[11px] font-bold bg-background/50 border-muted/20 focus:border-green-400 text-center px-1 rounded-lg",
                        log.overtime_minutes > 0 ? "text-green-600 font-extrabold" : "text-muted-foreground/40"
                      )}
                    />
                    <span className="text-[8px] text-muted-foreground uppercase font-semibold tracking-tighter text-center mt-0.5">mins</span>
                  </div>
                </TableCell>

                <TableCell className="px-2 py-2 text-center align-middle">
                  <div className="flex justify-center">
                    <Select 
                      value={log.approval_status || "pending"} 
                      onValueChange={(val) => onUpdateRow(log.log_id, "approval_status", val)}
                    >
                      <SelectTrigger className={cn(
                        "h-7 rounded-lg font-bold text-[8px] uppercase tracking-wider border border-muted/20 px-2 py-0 w-[84px] shadow-xs",
                        log.approval_status === "approved" ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300" : 
                        log.approval_status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" : 
                        "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300"
                      )}>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border shadow-2xl">
                        <SelectItem value="pending" className="text-[8px] font-bold uppercase tracking-wider text-blue-600">Pending</SelectItem>
                        <SelectItem value="approved" className="text-[8px] font-bold uppercase tracking-wider text-green-600">Approved</SelectItem>
                        <SelectItem value="rejected" className="text-[8px] font-bold uppercase tracking-wider text-red-600">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-2 text-center align-middle">
                  <div className="flex items-center justify-center gap-1.5 transition-opacity duration-300">
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn(
                        "h-7 w-7 p-0 rounded-xl transition-all active:scale-90 shadow-sm",
                        savingLogId === log.log_id ? "text-muted-foreground" : "text-primary hover:bg-primary/10"
                      )}
                      onClick={() => handleLocalSave(log)}
                      disabled={savingLogId === log.log_id}
                      title="Save this row"
                    >
                      {savingLogId === log.log_id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      <span className="sr-only">Save</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 rounded-xl text-green-600 hover:bg-green-500 hover:text-white transition-all active:scale-90 shadow-sm"
                      onClick={() => handleOpenModal(log, "approve")}
                      disabled={log.approval_status === "approved"}
                    >
                      <Check className="h-3 w-3" />
                      <span className="sr-only">Approve</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 rounded-xl text-red-600 hover:bg-red-500 hover:text-white transition-all active:scale-90 shadow-sm"
                      onClick={() => handleOpenModal(log, "reject")}
                      disabled={log.approval_status === "rejected"}
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Reject</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {selectedLog && (
          <ApprovalModal
            isOpen={!!selectedLog}
            onClose={handleCloseModal}
            onConfirm={handleConfirm}
            title={modalMode === "approve" ? "Approve Attendance" : "Reject Attendance"}
            description={
              modalMode === "approve"
                ? `Are you sure you want to approve attendance for ${selectedLog.user_fname} ${selectedLog.user_lname} on ${format(new Date(selectedLog.log_date), "MMM dd, yyyy")}?`
                : `Are you sure you want to reject attendance for ${selectedLog.user_fname} ${selectedLog.user_lname} on ${format(new Date(selectedLog.log_date), "MMM dd, yyyy")}?`
            }
            confirmText={modalMode === "approve" ? "Approve" : "Reject"}
            confirmVariant={modalMode === "approve" ? "default" : "destructive"}
            log={selectedLog}
          />
        )}
      </div>
    </div>
  );
}
