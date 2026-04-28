"use client";

import React, { useState, useMemo } from "react";
import { AnyTARequest, RequestType, TAActionPayload, UndertimeRequest } from "../types";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  User,
  Search,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Calendar,
  Clock,
  ChevronRight,
  AlertTriangle,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

/* ─────────────────────────────────────────────────────────────────────────────
 *  Helpers
 * ───────────────────────────────────────────────────────────────────────────── */

const TYPE_CONFIG = {
  leave: {
    label: "Leave Requests",
    gradient: "from-blue-700 to-blue-900",
    accentBg: "bg-blue-50",
    accentText: "text-blue-700",
    accentBorder: "border-blue-200",
    pillBg: "bg-blue-100",
  },
  overtime: {
    label: "Overtime Requests",
    gradient: "from-violet-700 to-purple-900",
    accentBg: "bg-violet-50",
    accentText: "text-violet-700",
    accentBorder: "border-violet-200",
    pillBg: "bg-violet-100",
  },
  undertime: {
    label: "Undertime Requests",
    gradient: "from-orange-600 to-orange-800",
    accentBg: "bg-amber-50",
    accentText: "text-amber-700",
    accentBorder: "border-amber-200",
    pillBg: "bg-amber-100",
  },
};

function getUserName(item: AnyTARequest): string {
  const u = item.user_id;
  if (typeof u !== "number" && u?.user_fname) return `${u.user_fname} ${u.user_lname}`.trim();
  return `User #${typeof u === "number" ? u : u?.user_id ?? "?"}`;
}

function getUserPosition(item: AnyTARequest): string {
  const u = item.user_id;
  return (typeof u !== "number" && u?.user_position) ? u.user_position : "Employee";
}

function getUserDepartment(item: AnyTARequest): string {
  if ("department_name" in item && item.department_name) return item.department_name as string;
  const u = item.user_id;
  return (typeof u !== "number" && u?.user_department?.department_name) ? u.user_department.department_name : "";
}

function getRequestId(item: AnyTARequest): number {
  if ("leave_id" in item) return item.leave_id;
  if ("overtime_id" in item) return item.overtime_id;
  return (item as UndertimeRequest).undertime_id;
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  } catch { return d; }
}

function formatTime(t: string | null | undefined) {
  if (!t) return "—";
  try {
    const [h, m] = t.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  } catch { return t; }
}

function getStatusColor(status: string) {
  switch (status) {
    case "approved": return "bg-emerald-500/10 text-emerald-700 border-emerald-300";
    case "rejected": return "bg-red-500/10 text-red-700 border-red-300";
    case "returned": return "bg-amber-500/10 text-amber-700 border-amber-300";
    default:          return "bg-blue-500/10 text-blue-700 border-blue-300";
  }
}

function renderRequestSummary(item: AnyTARequest, type: RequestType) {
  if (type === "leave" && "leave_type" in item) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="font-black text-sm capitalize text-foreground">{item.leave_type} Leave</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded border border-blue-200 w-fit">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(item.leave_start)} → {formatDate(item.leave_end)}
          {item.total_days ? <span className="text-blue-700/60 ml-1">({item.total_days}d)</span> : null}
        </span>
      </div>
    );
  }
  if (type === "overtime" && "ot_from" in item) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded border border-violet-200 w-fit">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(item.request_date)}
        </span>
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
          {formatTime(item.ot_from)} → {formatTime(item.ot_to)} <span className="opacity-60">({Math.round((item.duration_minutes || 0) / 60 * 10) / 10}h)</span>
        </span>
      </div>
    );
  }
  if (type === "undertime" && "actual_timeout" in item) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200 w-fit">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(item.request_date)}
        </span>
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
          Sched: {formatTime(item.sched_timeout)} | Out: {formatTime(item.actual_timeout)}
        </span>
      </div>
    );
  }
  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  Action Confirmation Row
 * ───────────────────────────────────────────────────────────────────────────── */
function ActionButtons({
  requestId,
  type,
  status,
  isActing,
  onAction,
  currentLevel,
  assignedLevel,
  isHRHead,
  onOverride,
}: {
  requestId: number;
  type: RequestType;
  status: string;
  isActing: boolean;
  onAction: (payload: TAActionPayload) => Promise<boolean | void>;
  currentLevel?: number;
  assignedLevel?: number;
  isHRHead?: boolean;
  onOverride?: () => void;
}) {
  const [remarksOpen, setRemarksOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | "return" | null>(null);
  const [remarks, setRemarks] = useState("");

  const isLevelMismatch = assignedLevel !== undefined && currentLevel !== undefined && currentLevel !== assignedLevel;

  if (isHRHead && status === "pending") {
    const canOverride = (currentLevel ?? 0) > 1;

    if (!canOverride) {
      return (
        <Badge variant="outline" className="text-[10px] font-bold uppercase text-amber-700 border-amber-200 bg-amber-50">
          Locked: Waiting for L1 Review
        </Badge>
      );
    }

    return (
      <Button 
        onClick={onOverride}
        size="sm"
        className="w-full h-8 text-[11px] font-black uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-200"
      >
        <AlertTriangle className="h-3.5 w-3.5 mr-2" />
        Force Override
      </Button>
    )
  }

  if (status !== "pending" || isLevelMismatch) {
    const isForwarded = status === "pending" && isLevelMismatch;
    let fallbackText = status;
    if (isForwarded && currentLevel !== undefined && assignedLevel !== undefined) {
      fallbackText = currentLevel < assignedLevel 
        ? `Awaiting Lvl ${currentLevel}` 
        : "Pending Next Approver";
    }

    return (
      <Badge variant="outline" className={cn("text-[10px] font-bold uppercase", isForwarded ? "text-blue-700 border-blue-200 bg-blue-100" : getStatusColor(status))}>
        {fallbackText}
      </Badge>
    );
  }

  const handleTrigger = (action: "approve" | "reject" | "return") => {
    setPendingAction(action);
    setRemarksOpen(true);
    setRemarks("");
  };

  const handleConfirm = async () => {
    if (!pendingAction) return;
    setRemarksOpen(false);
    await onAction({ requestId, type, action: pendingAction, remarks });
    setPendingAction(null);
    setRemarks("");
  };

  // if (isHRHead) return null; // Removed - handled above with Force Override button

  return (
    <div className="flex flex-col gap-2">
      {/* Action triggers */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => handleTrigger("approve")}
          disabled={isActing}
          title="Approve"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-40"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
        </button>
        {currentLevel !== undefined && currentLevel > 1 && (
          <button
            onClick={() => handleTrigger("return")}
            disabled={isActing}
            title="Return"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Return
          </button>
        )}
        <button
          onClick={() => handleTrigger("reject")}
          disabled={isActing}
          title="Reject"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-40"
        >
          <XCircle className="h-3.5 w-3.5" /> Reject
        </button>
      </div>

      {/* Inline remarks & confirm */}
      {remarksOpen && (
        <div className="flex flex-col gap-2 p-3 rounded-xl bg-muted/50 border border-muted-foreground/10 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <AlertTriangle className="h-3 w-3" />
            Confirm: {pendingAction?.toUpperCase()}
          </div>
          <textarea
            placeholder="Remarks (required)..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            className="text-xs resize-none rounded-lg border border-muted-foreground/20 bg-background px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/50"
          />
          <div className="flex gap-1.5 justify-end">
            <Button size="sm" variant="ghost" onClick={() => { setRemarksOpen(false); setPendingAction(null); }} className="h-7 text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirm} disabled={isActing || !remarks.trim()}
              className={cn(
                "h-7 text-xs font-bold",
                pendingAction === "approve" && "bg-emerald-600 hover:bg-emerald-700",
                pendingAction === "reject"  && "bg-red-600 hover:bg-red-700",
                pendingAction === "return"  && "bg-amber-600 hover:bg-amber-700",
              )}
            >
              {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : `Confirm ${pendingAction}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  Employee Request Drawer — all requests for one employee in one type
 * ───────────────────────────────────────────────────────────────────────────── */
function EmployeeRequestsDrawer({
  open,
  onOpenChange,
  type,
  employee,
  requests,
  onAction,
  isActing,
  isHRHead,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: RequestType;
  employee: { name: string; position: string; department?: string };
  requests: AnyTARequest[];
  onAction: (payload: TAActionPayload) => Promise<boolean | void>;
  isActing: boolean;
  isHRHead: boolean;
}) {
  const cfg = TYPE_CONFIG[type];
  const pendingRequests = requests.filter(r => {
    if (r.status !== "pending") return false;
    if (isHRHead) return (r.current_approval_level ?? 0) > 1;
    return (r.assigned_level === undefined || r.current_approval_level === r.assigned_level);
  });

  // ── HR Override State ─────────────────────────────────────────────────────
  const [overrideRequestId, setOverrideRequestId] = useState<number | null>(null);
  const [overrideFile, setOverrideFile]           = useState<File | null>(null);
  const [overrideRemarks, setOverrideRemarks]     = useState("");
  const [isUploading, setIsUploading]             = useState(false);

  // ── Bulk Override State ───────────────────────────────────────────────────
  const [isBulkOverrideMode, setIsBulkOverrideMode] = useState(false);
  const [bulkActionType, setBulkActionType]         = useState<'approve_override' | 'reject_override'>('approve_override');
  const [bulkFile, setBulkFile]                     = useState<File | null>(null);
  const [bulkRemarks, setBulkRemarks]               = useState("");

  const handleOverride = async (requestId: number, actionType: 'approve_override' | 'reject_override' = 'approve_override') => {
    if (!overrideFile) {
      toast.error("Please select a file for proof (e.g., signed memo/email)");
      return;
    }
    if (!overrideRemarks.trim()) {
      toast.error("Please provide override remarks.");
      return;
    }

    setIsUploading(true);
    try {
      // 1. Upload proof to Directus
      const fd = new FormData();
      fd.append("file", overrideFile);
      
      const res = await fetch(`/api/hrm/employee-admin/employee-master-list/upload?type=hr_attachment`, {
        method: "POST",
        body: fd
      });

      if (!res.ok) throw new Error("File upload failed");
      const json = await res.json();
      const attachment_uuid = json?.data?.id;

      if (!attachment_uuid) throw new Error("Failed to receive attachment UUID");

      // 2. Perform override action
      await onAction({
        requestId,
        type,
        action: actionType,
        remarks: overrideRemarks,
        isOverride: true,
        attachment_uuid
      });

      const actionLabel = actionType === 'approve_override' ? "Approved" : "Rejected";
      toast.success(`HR Override successful. Request is now ${actionLabel}.`);
      setOverrideRequestId(null);
      setOverrideFile(null);
      setOverrideRemarks("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Override failed";
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleBulkAction = async (action: "approve" | "reject") => {
    if (isHRHead) {
      setBulkActionType(action === "approve" ? "approve_override" : "reject_override");
      setIsBulkOverrideMode(true);
      return;
    }

    for (const req of pendingRequests) {
      await onAction({
        requestId: getRequestId(req),
        type,
        action,
        remarks: `Bulk ${action} by approver`,
      });
    }
    toast.success(`${pendingRequests.length} request(s) ${action}d`);
  };

  const executeBulkOverride = async () => {
    if (!bulkFile) {
      toast.error("Please select a file for bulk override proof");
      return;
    }
    if (!bulkRemarks.trim()) {
      toast.error("Please provide bulk override remarks.");
      return;
    }

    setIsUploading(true);
    try {
      // 1. Upload proof once
      const fd = new FormData();
      fd.append("file", bulkFile);
      
      const res = await fetch(`/api/hrm/employee-admin/employee-master-list/upload?type=hr_attachment`, {
        method: "POST",
        body: fd
      });
      if (!res.ok) throw new Error("File upload failed");
      const json = await res.json();
      const attachment_uuid = json?.data?.id;
      if (!attachment_uuid) throw new Error("Failed to receive attachment UUID");

      // 2. Process all pending requests
      let successCount = 0;
      for (const req of pendingRequests) {
        const ok = await onAction({
          requestId: getRequestId(req),
          type,
          action: bulkActionType,
          remarks: `[BULK OVERRIDE] ${bulkRemarks}`,
          isOverride: true,
          attachment_uuid
        });
        if (ok !== false) successCount++;
      }

      toast.success(`Bulk HR Override successful. ${successCount} requests updated.`);
      setIsBulkOverrideMode(false);
      setBulkFile(null);
      setBulkRemarks("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bulk override failed";
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col overflow-hidden border-l shadow-2xl">
        {/* Header */}
        <div className={cn("bg-gradient-to-br p-8 shrink-0", cfg.gradient)}>
          <SheetHeader className="p-0 text-left">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-sm ring-1 ring-white/20">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <SheetTitle className="text-xl font-black text-white tracking-tight">
                  {employee.name}
                </SheetTitle>
                <SheetDescription className="text-white/70 font-semibold text-xs uppercase tracking-widest flex flex-col gap-0.5">
                  <span>{employee.position} · {cfg.label}</span>
                  {employee.department && (
                    <span className="text-white/40 text-[10px] font-bold">{employee.department}</span>
                  )}
                </SheetDescription>
              </div>
            </div>

            {/* Bulk actions */}
            {pendingRequests.length > 0 && (
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/20">
                <span className="text-xs text-white/70 font-bold flex-1">
                  {pendingRequests.length} pending request{pendingRequests.length > 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => handleBulkAction("approve")}
                  disabled={isActing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-white/20 hover:bg-white/30 text-white border border-white/20 transition-all disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve All
                </button>
                <button
                  onClick={() => handleBulkAction("reject")}
                  disabled={isActing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject All
                </button>
              </div>
            )}
          </SheetHeader>
        </div>

        {/* Request List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Bulk Override Panel */}
          {isBulkOverrideMode && (
            <div className="p-5 rounded-2xl border-2 border-red-200 bg-red-50/30 mb-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
               <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-sm font-black uppercase tracking-widest">Bulk Force Override Confirmation</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsBulkOverrideMode(false)}
                  className="h-7 text-[10px] font-bold uppercase text-muted-foreground hover:text-foreground"
                >
                  Cancel Bulk
                </Button>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-bold text-red-800 bg-red-100/50 p-3 rounded-lg border border-red-100">
                  You are about to <span className="underline decoration-2">{bulkActionType === "approve_override" ? "APPROVE" : "REJECT"}</span> all {pendingRequests.length} pending requests for this employee using HR Force Override authority.
                </p>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-red-900/60 ml-1">Universal Proof Attachment</label>
                  <Input 
                    type="file" 
                    onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                    className="h-10 text-[11px] bg-white border-red-200 focus-visible:ring-red-200 file:text-[10px] file:font-black file:uppercase file:bg-red-50 file:text-red-700 file:border-red-100 file:rounded-md file:mr-3"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-red-900/60 ml-1">Bulk Override Logic/Remarks</label>
                  <textarea 
                    placeholder="Provide reasoning for this bulk override action..."
                    value={bulkRemarks}
                    onChange={(e) => setBulkRemarks(e.target.value)}
                    className="w-full h-24 text-xs p-3 rounded-lg border border-red-200 bg-white focus:outline-none focus:ring-1 focus:ring-red-300 placeholder:text-muted-foreground/50 resize-none"
                  />
                </div>

                <Button 
                  className={cn(
                    "w-full h-11 text-white font-black uppercase text-xs tracking-[0.2em] shadow-lg transition-transform active:scale-[0.98]",
                    bulkActionType === "approve_override" ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" : "bg-red-600 hover:bg-red-700 shadow-red-200"
                  )}
                  disabled={isUploading || isActing || !bulkFile || !bulkRemarks.trim()}
                  onClick={executeBulkOverride}
                >
                  {isUploading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                  {isUploading ? "Processing Batch..." : `Confirm Bulk ${bulkActionType === "approve_override" ? "Approval" : "Rejection"}`}
                </Button>
              </div>
            </div>
          )}

          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 opacity-40">
              <FileText className="h-10 w-10 mb-2" />
              <p className="text-sm font-bold">No requests found</p>
            </div>
          ) : (
            requests.map((req) => {
              const rid = getRequestId(req);
              return (
                <div
                  key={rid}
                  className={cn(
                    "p-5 rounded-2xl border bg-card shadow-sm transition-all duration-300",
                    req.status === "pending"
                      ? "border-border hover:border-primary/20 hover:shadow-md"
                      : "border-muted opacity-70"
                  )}
                >
                  {/* Summary + Status */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1">{renderRequestSummary(req, type)}</div>
                    <Badge variant="outline" className={cn("shrink-0 text-[10px] font-bold uppercase border", getStatusColor(req.status))}>
                      {req.status}
                    </Badge>
                  </div>

                  {/* Reason & Date Filed */}
                  <div className="bg-muted/30 rounded-xl p-3 mb-4 border border-border/50 shadow-inner">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/50">
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Reason/Purpose</div>
                      <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1"><Clock className="h-3 w-3" /> Filed: {formatDate(req.filed_at)}</div>
                    </div>
                    <p className="text-xs text-foreground font-medium leading-relaxed break-words">
                      {("reason" in req && req.reason) || ("purpose" in req && req.purpose) || <span className="italic text-muted-foreground">No reason provided by employee.</span>}
                    </p>
                  </div>

                  {/* Remarks */}
                  {req.remarks && (
                    <p className="text-xs text-muted-foreground italic bg-muted/40 px-3 py-2 rounded-xl mb-4 border border-muted-foreground/10 break-words">
                      {req.remarks}
                    </p>
                  )}

                  {/* Approval Progress Stepper */}
                  <div className="flex flex-col gap-1.5 mb-5 mt-2">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                      <span className="text-muted-foreground">Approval Progress</span>
                      <span className={cn(req.status === "approved" ? "text-emerald-600" : "text-foreground")}>
                        {req.status === "approved" 
                          ? "Fully Approved" 
                          : `Level ${Math.min(req.current_approval_level, Math.max(req.total_levels || 1, req.current_approval_level))} of ${Math.max(req.total_levels || 1, req.current_approval_level)}`}
                      </span>
                    </div>
                    <div className="flex gap-1 h-1.5 w-full">
                      {Array.from({ length: Math.max(req.total_levels || 1, req.current_approval_level) }).map((_, i) => {
                        const stepLevel = i + 1;
                        const isCompleted = stepLevel < req.current_approval_level || req.status === "approved";
                        const isCurrent = stepLevel === req.current_approval_level && req.status === "pending";
                        
                        return (
                          <div
                            key={i}
                            className={cn(
                              "flex-1 rounded-full transition-all duration-500",
                              isCompleted ? `bg-gradient-to-r ${cfg.gradient} opacity-100 shadow-sm` :
                              isCurrent ? `bg-gradient-to-r ${cfg.gradient} opacity-50 animate-pulse` :
                              "bg-muted border border-muted-foreground/10"
                            )}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <ActionButtons
                    requestId={rid}
                    type={type}
                    status={req.status}
                    isActing={isActing}
                    onAction={onAction}
                    currentLevel={req.current_approval_level}
                    assignedLevel={req.assigned_level}
                    isHRHead={isHRHead}
                    onOverride={() => setOverrideRequestId(overrideRequestId === rid ? null : rid)}
                  />

                  {/* HR Override Section */}
                  {isHRHead && req.status === "pending" && (
                    <div className="mt-4 pt-4 border-t border-dashed border-red-200">
                      <div className="flex items-center gap-1.5 text-red-700 font-black uppercase tracking-widest text-[11px] mb-3">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Override Form</span>
                      </div>

                      {overrideRequestId === rid && (
                        <div className="space-y-3 p-4 rounded-xl bg-red-50/30 border border-red-200 animate-in fade-in slide-in-from-top-2 duration-300">
                          <p className="text-[10px] font-bold text-red-800 leading-tight">
                            Providing a proof of permission attachment and remarks will immediately move this request to Final Approved or Rejected.
                          </p>
                          
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase text-red-900/60 ml-1">Attachment (Required)</label>
                            <Input 
                              type="file" 
                              onChange={(e) => setOverrideFile(e.target.files?.[0] || null)}
                              className="h-10 text-[11px] bg-white border-red-200 focus-visible:ring-red-200 file:text-[10px] file:font-black file:uppercase file:bg-red-50 file:text-red-700 file:border-red-100 file:rounded-md file:mr-3"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase text-red-900/60 ml-1">Override Logic/Remarks</label>
                            <textarea 
                              placeholder="Why is this being overridden? (e.g. Per email from Dept Head...)"
                              value={overrideRemarks}
                              onChange={(e) => setOverrideRemarks(e.target.value)}
                              className="w-full h-20 text-xs p-3 rounded-lg border border-red-200 bg-white focus:outline-none focus:ring-1 focus:ring-red-300 placeholder:text-muted-foreground/50 resize-none"
                            />
                          </div>

                          <div className="flex gap-3">
                            <Button 
                              className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-widest shadow-md shadow-emerald-200"
                              disabled={isUploading || isActing || !overrideFile || !overrideRemarks.trim()}
                              onClick={() => handleOverride(rid, 'approve_override')}
                            >
                              {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                              {isUploading ? "Uploading..." : "Approve Override"}
                            </Button>

                            <Button 
                              className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white font-black uppercase text-xs tracking-widest shadow-md shadow-red-200"
                              disabled={isUploading || isActing || !overrideFile || !overrideRemarks.trim()}
                              onClick={() => handleOverride(rid, 'reject_override')}
                            >
                              {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                              {isUploading ? "Uploading..." : "Reject Override"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  Main: RequestTypeModal — employee list grouped
 * ───────────────────────────────────────────────────────────────────────────── */
export interface RequestTypeModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: RequestType;
  requests: AnyTARequest[];
  onAction: (payload: TAActionPayload) => Promise<boolean | void>;
  isActing: boolean;
  isHRHead: boolean;
}

export function RequestTypeModal({
  open,
  onOpenChange,
  type,
  requests,
  onAction,
  isActing,
  isHRHead,
}: RequestTypeModalProps) {
  const cfg = TYPE_CONFIG[type];
  const [search, setSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  // Group requests by user_id
  const employeeGroups = useMemo(() => {
    const map = new Map<number, { name: string; position: string; department: string; requests: AnyTARequest[] }>();

    for (const req of requests) {
      const u = req.user_id;
      const uid: number = typeof u === "number" ? u : u?.user_id ?? 0;
      const name = getUserName(req);
      const position = getUserPosition(req);
      const department = getUserDepartment(req);

      if (!map.has(uid)) {
        map.set(uid, { name, position, department, requests: [] });
      }
      map.get(uid)!.requests.push(req);
    }

    return Array.from(map.entries()).map(([uid, data]) => ({ uid, ...data }));
  }, [requests]);

  const filtered = employeeGroups.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const selectedEmployee = selectedEmployeeId !== null
    ? employeeGroups.find(e => e.uid === selectedEmployeeId) ?? null
    : null;

  const pendingTotal = requests.filter(r => r.status === "pending").length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-3xl border-0 shadow-2xl gap-0">
          {/* Modal Header */}
          <div className={cn("bg-gradient-to-br p-8", cfg.gradient)}>
            <DialogHeader className="p-0 text-left">
              <DialogTitle className="text-2xl font-black text-white tracking-tight">
                {cfg.label}
              </DialogTitle>
              <DialogDescription className="text-white/70 font-medium mt-1">
                {pendingTotal > 0
                  ? `${pendingTotal} pending request${pendingTotal > 1 ? "s" : ""} from ${filtered.length} employee${filtered.length !== 1 ? "s" : ""}`
                  : `${requests.length} request${requests.length !== 1 ? "s" : ""} from ${filtered.length} employee${filtered.length !== 1 ? "s" : ""}`}
              </DialogDescription>
            </DialogHeader>

            {/* Search */}
            <div className="relative mt-5">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <Input
                placeholder="Search employee..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 h-11 bg-white/15 border-white/20 text-white placeholder:text-white/50 rounded-xl focus-visible:ring-white/30 font-medium"
              />
            </div>
          </div>

          {/* Employee List */}
          <div className="divide-y divide-muted-foreground/5 flex flex-col">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[385px] opacity-40 gap-2">
                <User className="h-10 w-10" />
                <p className="text-sm font-bold">No employees found</p>
              </div>
            ) : (
              <>
                {paginated.map((emp) => {
                  const pendingCount = emp.requests.filter(r => r.status === "pending").length;
                  return (
                    <button
                      key={emp.uid}
                      onClick={() => setSelectedEmployeeId(emp.uid)}
                      className="w-full flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors text-left group h-[77px]"
                    >
                      {/* Avatar */}
                      <div className={cn(
                        "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-black text-base uppercase ring-2 ring-offset-1",
                        cfg.pillBg, cfg.accentText,
                        `ring-offset-background ring-current/20`
                      )}>
                        {emp.name.charAt(0)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-foreground truncate">{emp.name}</div>
                        <div className="text-[10px] text-muted-foreground font-semibold truncate uppercase tracking-tight">
                          {emp.position} {emp.department && <span className="opacity-40 ml-1.5 border-l border-muted-foreground/30 pl-1.5 font-medium lowercase tracking-normal">{emp.department}</span>}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1.5 bg-muted/40 px-2 py-1 rounded-lg">
                          <span className="text-xs font-black text-foreground">{emp.requests.length}</span>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total</span>
                        </div>
                        {pendingCount > 0 && (
                          <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-black shadow-sm", cfg.pillBg, cfg.accentText)}>
                            <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", cfg.accentText.replace("text-", "bg-"))} />
                            {pendingCount} Pending
                          </div>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground/70 group-hover:translate-x-0.5 transition-all ml-1" />
                      </div>
                    </button>
                  );
                })}
                {/* Filler Empty Rows */}
                {Array.from({ length: itemsPerPage - paginated.length }).map((_, i) => (
                  <div key={`empty-${i}`} className="w-full h-[77px] pointer-events-none border-b-0" />
                ))}
              </>
            )}
          </div>

          {/* Pagination Controls */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between p-4 border-t border-muted/10 bg-muted/5 shrink-0">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 rounded-lg px-3 text-xs font-black shadow-sm bg-background border-muted-foreground/20 hover:bg-muted"
                >
                  Prev
                </Button>
                <span className="text-[11px] font-black text-foreground px-1 bg-muted/50 py-1 rounded w-10 text-center">
                  {currentPage} <span className="text-muted-foreground/50 mx-0.5">/</span> {totalPages}
                </span>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 rounded-lg px-3 text-xs font-black shadow-sm bg-background border-muted-foreground/20 hover:bg-muted"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Employee Requests Drawer (nested) */}
      {selectedEmployee && (
        <EmployeeRequestsDrawer
          open={!!selectedEmployee}
          onOpenChange={(v) => { if (!v) setSelectedEmployeeId(null); }}
          type={type}
          employee={selectedEmployee}
          requests={selectedEmployee.requests}
          onAction={onAction}
          isActing={isActing}
          isHRHead={isHRHead}
        />
      )}
    </>
  );
}
