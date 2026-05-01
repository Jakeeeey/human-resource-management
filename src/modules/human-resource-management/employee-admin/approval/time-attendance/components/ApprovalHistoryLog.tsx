"use client";

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ApprovalLogEntry, LeaveRequest, OvertimeRequest, UndertimeRequest, UserDetails } from "../types";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  RefreshCw,
  User,
  History,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────────
 *  Helpers
 * ───────────────────────────────────────────────────────────────────────────── */

const TYPE_LABELS: Record<string, string> = {
  leave:     "Leave",
  overtime:  "Overtime",
  undertime: "Undertime",
};

const TYPE_COLORS: Record<string, string> = {
  leave:     "bg-blue-100 text-blue-700 border-blue-200",
  overtime:  "bg-violet-100 text-violet-700 border-violet-200",
  undertime: "bg-amber-100 text-amber-700 border-amber-200",
};

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  approved: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: "text-emerald-700 bg-emerald-50 border-emerald-200",
    label: "Approved",
  },
  rejected: {
    icon: <XCircle className="h-3.5 w-3.5" />,
    color: "text-red-700 bg-red-50 border-red-200",
    label: "Rejected",
  },
  pending: {
    icon: <Clock className="h-3.5 w-3.5" />,
    color: "text-blue-700 bg-blue-50 border-blue-200",
    label: "Forwarded",
  },
  returned: {
    icon: <RotateCcw className="h-3.5 w-3.5" />,
    color: "text-amber-700 bg-amber-50 border-amber-200",
    label: "Returned",
  },
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
  });
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

function getRequestInfo(entry: ApprovalLogEntry) {
  const d = entry.request_details;
  if (!d) return "No preview available.";
  if (entry.request_type === "leave") {
    const l = d as unknown as LeaveRequest;
    return `${l.leave_type || "Leave"} (${formatDate(l.leave_start)} to ${formatDate(l.leave_end)})`;
  }
  if (entry.request_type === "overtime") {
    const o = d as unknown as OvertimeRequest;
    return `OT on ${formatDate(o.request_date)}: ${formatTime(o.ot_from)} to ${formatTime(o.ot_to)}`;
  }
  if (entry.request_type === "undertime") {
    const u = d as unknown as UndertimeRequest;
    return `UT on ${formatDate(u.request_date)}: Out at ${formatTime(u.actual_timeout)}`;
  }
  return "View request details";
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  Log Row
 * ───────────────────────────────────────────────────────────────────────────── */
function LogRow({ entry }: { entry: ApprovalLogEntry }) {
  const status = STATUS_CONFIG[entry.status_after] ?? STATUS_CONFIG.returned;
  const typeColor = TYPE_COLORS[entry.request_type] ?? "bg-muted text-muted-foreground";
  const typeLabel = TYPE_LABELS[entry.request_type] ?? entry.request_type;

  return (
    <div className="flex items-start gap-3 py-3 px-4 hover:bg-muted/30 transition-colors animate-in fade-in border-t border-muted/50 first:border-0">
      <div className={cn("mt-1 w-7 h-7 rounded-lg flex items-center justify-center border shrink-0", status.color)}>
        {status.icon}
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-[10px] font-black uppercase tracking-wider border px-1.5 py-0.5 rounded", status.color)}>
            {status.label}
          </span>
          <span className={cn("text-[10px] font-bold uppercase tracking-widest border px-1.5 py-0.5 rounded", typeColor)}>
            {typeLabel}
          </span>
          
          {/* Explicit Approver Name */}
          <span className="text-[10px] font-bold text-foreground/80 lowercase italic flex items-center gap-1 ml-1">
            by{" "}
            <span className="not-italic font-black text-foreground uppercase tracking-tight">
              {entry.approver_id && typeof entry.approver_id === 'object' 
                ? (
                   ((entry.approver_id as UserDetails).user_fname || 
                    (entry.approver_id as Record<string, string>).first_name || 
                    (entry.approver_id as Record<string, string>).fname || 
                    "Unknown") + " " + 
                   ((entry.approver_id as UserDetails).user_lname || 
                    (entry.approver_id as Record<string, string>).last_name || 
                    (entry.approver_id as Record<string, string>).lname || 
                    "")
                  )
                : (typeof entry.approver_id === 'number' ? `Approver #${entry.approver_id}` : "System")}
            </span>
          </span>

          <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap hidden sm:block">
            {formatRelativeTime(entry.created_at)}
          </span>
        </div>

        <p className="text-xs font-medium text-foreground leading-snug">
          {getRequestInfo(entry)}
        </p>

        {entry.remarks && (
          <p className="text-xs text-muted-foreground italic bg-muted/50 px-2 py-1.5 rounded-md border border-muted/20 line-clamp-2 break-words">
            &quot;{entry.remarks}&quot;
          </p>
        )}
        
        <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 w-full pt-1">
          <span className="font-mono">ref: {entry.request_type}#{entry.request_id}</span>
          <span className="sm:hidden">{formatRelativeTime(entry.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  Employee Group Row
 * ───────────────────────────────────────────────────────────────────────────── */
function EmployeeGroupRow({
  name,
  position,
  department,
  logs,
}: {
  name: string;
  position: string;
  department: string;
  logs: ApprovalLogEntry[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-muted/30 last:border-0 group">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-4 px-6 py-4 hover:bg-muted/10 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
          <User className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-foreground truncate">{name}</div>
          <div className="text-[10px] text-muted-foreground font-semibold truncate uppercase tracking-tight mt-0.5">
            {position} {department && <span className="opacity-40 ml-1.5 border-l border-muted-foreground/30 pl-1.5 font-medium lowercase tracking-normal">{department}</span>}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex -space-x-1">
            <span className="text-xs font-black text-foreground bg-muted px-2 py-1 rounded-md border border-border/50">
              {logs.length} log{logs.length !== 1 ? "s" : ""}
            </span>
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground/50" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="bg-muted/5 border-t border-muted/20 pb-2">
          {logs.map((L) => (
            <LogRow key={L.history_id} entry={L} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  Main Component
 * ───────────────────────────────────────────────────────────────────────────── */
interface ApprovalHistoryLogProps {
  logs: ApprovalLogEntry[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function ApprovalHistoryLog({ logs, isLoading, onRefresh }: ApprovalHistoryLogProps) {
  const [filterType, setFilterType] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const handleFilterChange = (type: string) => {
    setFilterType(type);
    setCurrentPage(1);
  };

  const handleRefresh = () => {
    onRefresh();
    setCurrentPage(1);
  };

  const filtered = logs.filter((l) => {
    if (filterType !== "all" && l.request_type !== filterType) return false;
    return true;
  });

  // Group by employee
  const employeeGroups = useMemo(() => {
    const map = new Map<number | string, { name: string; position: string; department: string; logs: ApprovalLogEntry[] }>();

    for (const log of filtered) {
      let uid: string | number = `req-${log.request_id}`;
      let name = `Unknown User (Req #${log.request_id})`;
      let position = "Employee";
      let department = "";

      if (log.requester) {
        if (typeof log.requester === "object") {
          uid = log.requester.user_id;
          name = `${log.requester.user_fname} ${log.requester.user_lname}`.trim();
          position = log.requester.user_position ?? "Employee";
          department = log.requester.user_department?.department_name ?? "";
        } else if (typeof log.requester === "number") {
          uid = log.requester;
          name = `Unknown User #${log.requester}`;
        }
      }

      if (!map.has(uid)) {
        map.set(uid, { name, position, department, logs: [] });
      }
      map.get(uid)!.logs.push(log);
    }

    return Array.from(map.entries()).map(([id, data]) => ({ id, ...data }));
  }, [filtered]);

  const totalPages = Math.ceil(employeeGroups.length / itemsPerPage);
  const paginatedGroups = employeeGroups.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="rounded-3xl border border-border/60 bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-muted-foreground/10 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black tracking-tight text-foreground">
              Approval Activity Log
            </h2>
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">
              Refined History Grouped by Employee
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </button>
      </div>

      {/* Filters */}
      {logs.length > 0 && (
        <div className="flex items-center gap-2 px-6 py-3 border-b border-muted-foreground/5 bg-muted/10 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">
            Type:
          </span>
          {["all", "leave", "overtime", "undertime"].map((t) => (
            <button
              key={t}
              onClick={() => handleFilterChange(t)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all",
                filterType === t
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-muted-foreground/20 hover:border-primary/30 hover:text-foreground"
              )}
            >
              {t === "all" ? "All Types" : t}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="divide-y divide-muted/10">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-4 px-6 py-4 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-muted rounded w-1/3" />
                <div className="h-2 bg-muted rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : employeeGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-40">
          <History className="h-10 w-10" />
          <p className="font-bold text-sm">No log entries found.</p>
        </div>
      ) : (
        <div className="divide-y divide-border/50 flex flex-col">
          {paginatedGroups.map((group) => (
            <EmployeeGroupRow
              key={group.id}
              name={group.name}
              position={group.position}
              department={group.department}
              logs={group.logs}
            />
          ))}
          {/* Filler Rows to maintain 5-row height */}
          {Array.from({ length: itemsPerPage - paginatedGroups.length }).map((_, i) => (
            <div key={`empty-${i}`} className="w-full h-[73px] pointer-events-none" />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && employeeGroups.length > 0 && (
        <div className="flex items-center justify-between p-4 border-t border-muted/10 bg-muted/5 shrink-0">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, employeeGroups.length)} of {employeeGroups.length}
          </span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 rounded-lg px-3 text-[11px] font-black shadow-sm bg-background border border-muted-foreground/20 hover:bg-muted disabled:opacity-30 transition-all"
            >
              Prev
            </button>
            <span className="text-[11px] font-black text-foreground px-1 bg-background/50 py-1 rounded w-10 text-center border border-muted-foreground/10">
              {currentPage} <span className="text-muted-foreground/50 mx-0.5">/</span> {totalPages}
            </span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8 rounded-lg px-3 text-[11px] font-black shadow-sm bg-background border border-muted-foreground/20 hover:bg-muted disabled:opacity-30 transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
