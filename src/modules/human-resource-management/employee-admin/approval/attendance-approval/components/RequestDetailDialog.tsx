"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Calendar,
  FileText,
  MessageSquare,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Timer,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { UtRequestInfo, OtRequestInfo } from "../type";

export type RequestDetailType = "undertime" | "overtime";

interface RequestDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  type: RequestDetailType;
  employeeName: string;
  logDate: string;
  utRequest?: UtRequestInfo | null;
  otRequest?: OtRequestInfo | null;
}

export function RequestDetailDialog({
  isOpen,
  onClose,
  type,
  employeeName,
  logDate,
  utRequest,
  otRequest,
}: RequestDetailDialogProps) {
  const isUndertime = type === "undertime";
  const request = isUndertime ? utRequest : otRequest;

  if (!request) return null;

  const status = (request.status || "pending").toLowerCase();

  const getStatusBadge = () => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1.5 px-3 py-1 font-bold text-xs rounded-full">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 gap-1.5 px-3 py-1 font-bold text-xs rounded-full">
            <XCircle className="h-3.5 w-3.5" />
            Rejected
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30 gap-1.5 px-3 py-1 font-bold text-xs rounded-full">
            Cancelled
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1.5 px-3 py-1 font-bold text-xs rounded-full">
            <AlertCircle className="h-3.5 w-3.5" />
            Pending Approval
          </Badge>
        );
    }
  };

  const formatDateSafely = (dateString?: string | null) => {
    if (!dateString) return null;
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      return format(d, "MMM dd, yyyy • hh:mm a");
    } catch {
      return dateString;
    }
  };

  const formatTimeSafely = (timeString?: string | null) => {
    if (!timeString) return "--:--";
    try {
      if (timeString.includes("T")) {
        return format(new Date(timeString), "hh:mm a");
      }
      const parts = timeString.split(":");
      if (parts.length >= 2) {
        let hour = parseInt(parts[0], 10);
        const minute = parts[1];
        const ampm = hour >= 12 ? "PM" : "AM";
        hour = hour % 12 || 12;
        return `${String(hour).padStart(2, "0")}:${minute} ${ampm}`;
      }
      return timeString;
    } catch {
      return timeString;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl p-0 flex flex-col gap-0 border border-border/50 shadow-2xl overflow-hidden rounded-2xl bg-background">
        {/* Header */}
        <DialogHeader className="px-6 py-5 border-b border-border/40 bg-muted/20 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "h-11 w-11 rounded-xl flex items-center justify-center border shadow-xs",
                  isUndertime
                    ? "bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                )}
              >
                {isUndertime ? <Clock className="h-5 w-5" /> : <Timer className="h-5 w-5" />}
              </div>
              <div>
                <DialogTitle className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
                  {isUndertime ? "Undertime Request" : "Overtime Request"}
                  <span className="text-xs font-mono text-muted-foreground font-semibold">
                    #{isUndertime ? "UT" : "OT"}-{request.id}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs font-medium text-muted-foreground flex items-center gap-2 mt-0.5">
                  <User className="h-3 w-3 text-primary/70" />
                  <span className="font-semibold text-foreground">{employeeName}</span>
                  <span>•</span>
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span>
                    {logDate ? format(new Date(logDate), "MMMM dd, yyyy") : "--"}
                  </span>
                </DialogDescription>
              </div>
            </div>
            <div className="mr-6">{getStatusBadge()}</div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh] custom-scrollbar">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-card/50 p-3.5 rounded-xl border border-border/60 shadow-xs flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Duration
              </span>
              <span className="text-lg font-black text-foreground font-mono">
                {request.duration_minutes ?? 0}{" "}
                <span className="text-xs font-semibold text-muted-foreground">mins</span>
              </span>
            </div>

            {isUndertime && utRequest && (
              <>
                <div className="bg-card/50 p-3.5 rounded-xl border border-border/60 shadow-xs flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Scheduled Timeout
                  </span>
                  <span className="text-sm font-bold text-foreground font-mono">
                    {formatTimeSafely(utRequest.sched_timeout)}
                  </span>
                </div>

                <div className="bg-card/50 p-3.5 rounded-xl border border-border/60 shadow-xs flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Requested Timeout
                  </span>
                  <span className="text-sm font-bold text-orange-600 dark:text-orange-400 font-mono">
                    {formatTimeSafely(utRequest.actual_timeout)}
                  </span>
                </div>
              </>
            )}

            {!isUndertime && otRequest && (
              <>
                <div className="bg-card/50 p-3.5 rounded-xl border border-border/60 shadow-xs flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    OT Start
                  </span>
                  <span className="text-sm font-bold text-foreground font-mono">
                    {formatTimeSafely(otRequest.ot_from)}
                  </span>
                </div>

                <div className="bg-card/50 p-3.5 rounded-xl border border-border/60 shadow-xs flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    OT End
                  </span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatTimeSafely(otRequest.ot_to)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Reason / Purpose Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span>{isUndertime ? "Reason for Undertime" : "Overtime Purpose"}</span>
            </div>
            <div className="bg-muted/30 p-4 rounded-xl border border-border/50 text-sm text-foreground leading-relaxed font-medium whitespace-pre-wrap">
              {isUndertime
                ? utRequest?.reason || "No reason specified."
                : otRequest?.purpose || "No purpose specified."}
            </div>
          </div>

          {/* Approver Remarks Section */}
          {(request.remarks || (isUndertime && utRequest?.remarks)) && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
                <span>Approver Remarks</span>
              </div>
              <div className="bg-muted/30 p-4 rounded-xl border border-border/50 text-sm text-foreground/90 leading-relaxed font-medium whitespace-pre-wrap">
                {request.remarks || (isUndertime ? utRequest?.remarks : "")}
              </div>
            </div>
          )}

          {/* Timestamps Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40 text-xs text-muted-foreground">
            <div>
              <span className="font-semibold text-foreground/70">Filed At: </span>
              <span>{formatDateSafely(request.filed_at) || "Not recorded"}</span>
            </div>
            <div>
              <span className="font-semibold text-foreground/70">Approved At: </span>
              <span>{formatDateSafely(request.approved_at) || "Pending"}</span>
            </div>
          </div>

          {/* Attachments Section if present */}
          {isUndertime &&
            utRequest &&
            (utRequest.emp_attatchment_uuid || utRequest.override_attachment_uuid) && (
              <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-primary">
                  <Paperclip className="h-4 w-4" />
                  <span>Supporting Attachment Available</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {utRequest.emp_attatchment_uuid || utRequest.override_attachment_uuid}
                </Badge>
              </div>
            )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/40 bg-muted/20 flex justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-xl px-5 h-9 font-bold"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
