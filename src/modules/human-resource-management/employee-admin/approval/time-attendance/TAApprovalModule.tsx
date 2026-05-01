"use client";

import React, { useState, useMemo } from "react";
import { Calendar, Clock, RotateCcw, ClipboardCheck, FilterX, Building2 } from "lucide-react";
import { useTAApproval } from "./hooks/useTAApproval";
import { RequestTypeCard } from "./components/RequestTypeCard";
import { RequestTypeModal } from "./components/RequestTypeModal";
import { ApprovalHistoryLog } from "./components/ApprovalHistoryLog";
import { AnyTARequest, RequestType, TAActionPayload } from "./types";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxEmpty,
} from "@/components/ui/combobox";

type ActiveModal = RequestType | null;

function groupByType(queue: AnyTARequest[]) {
  const leave     = queue.filter((r) => "leave_id"     in r);
  const overtime  = queue.filter((r) => "overtime_id"  in r);
  const undertime = queue.filter((r) => "undertime_id" in r);
  return { leave, overtime, undertime };
}

function getCutoffDates(year: number, month: number, cutoff: 1 | 2): { startDate: string, endDate: string } {
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (cutoff === 1) {
    const prevMonthDate = new Date(year, month - 1, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth() + 1;
    const curMonth = month + 1;
    return {
      startDate: `${prevYear}-${pad(prevMonth)}-26`,
      endDate: `${year}-${pad(curMonth)}-10`,
    };
  } else {
    const curMonth = month + 1;
    return {
      startDate: `${year}-${pad(curMonth)}-11`,
      endDate: `${year}-${pad(curMonth)}-25`,
    };
  }
}

export default function TAApprovalModule() {
  const {
    managerQueue, approvalLogs, isLoading, isLogsLoading,
    isHRHead, departments, selectedDepartmentId, setSelectedDepartmentId,
    refreshLogs, performAction, filters, setFilters, refresh, lastUpdated
  } = useTAApproval();

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [isActing, setIsActing]       = useState(false);

  const currentDate = new Date();
  const [selectedYear, setSelectedYear]       = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth]     = useState<number>(currentDate.getMonth());
  const [selectedCutoff, setSelectedCutoff]   = useState<1 | 2>(currentDate.getDate() <= 10 ? 1 : 2);
  const [isFilterActive, setIsFilterActive]   = useState(false);

  const applyFilter = () => {
    const dates = getCutoffDates(selectedYear, selectedMonth, selectedCutoff);
    setFilters({ ...filters, startDate: dates.startDate, endDate: dates.endDate });
    setIsFilterActive(true);
  };

  const clearFilter = () => {
    setFilters({ ...filters, startDate: undefined, endDate: undefined });
    setSelectedDepartmentId(undefined);
    setIsFilterActive(false);
  };

  const { leave, overtime, undertime } = useMemo(
    () => groupByType(managerQueue),
    [managerQueue]
  );

  const handleAction = async (payload: TAActionPayload) => {
    setIsActing(true);
    await performAction(payload);
    setIsActing(false);
  };

  const totalPending = managerQueue.filter(r => r.status === "pending").length;

  return (
    <div className="space-y-10 w-full px-10 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl shadow-inner border border-primary/20 text-primary">
            <ClipboardCheck className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-br from-foreground to-foreground/50 bg-clip-text text-transparent">
              T&amp;A Approvals
            </h1>
            <p className="text-muted-foreground text-sm font-semibold uppercase tracking-widest mt-1 opacity-70">
              {isHRHead ? "HR Department Head — Global View" : "Committee Review Dashboard"}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex flex-col items-end">
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                 System Status: <span className="text-emerald-500">Live</span>
               </p>
               <p className="text-[10px] font-medium text-muted-foreground/40">
                 Last updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
               </p>
            </div>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => refresh()} 
              disabled={isLoading}
              className="h-10 w-10 rounded-xl border-border/40 hover:bg-primary/5 hover:text-primary transition-all duration-300"
            >
              <RotateCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            
            {/* HR Head badge */}
            {isHRHead && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600">
                <Building2 className="h-4 w-4" />
                <span className="text-xs font-black uppercase tracking-widest">HR Override Access</span>
              </div>
            )}
          </div>
        </div>

        {/* Summary bar */}
        {!isLoading && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground pt-2 animate-in fade-in duration-700">
            {totalPending > 0 ? (
              <>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black border border-primary/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  {totalPending} total pending
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs font-medium opacity-70">
                  {isHRHead
                    ? selectedDepartmentId
                      ? `Filtered: ${departments.find(d => d.department_id === selectedDepartmentId)?.department_name ?? "Department"}`
                      : "Showing all departments"
                    : "Select a request type below to start reviewing"}
                </span>
              </>
            ) : (
              <span className="text-xs font-medium opacity-60 italic">
                All requests are up to date — no pending items.
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-2xl border border-border/40 backdrop-blur-sm flex-wrap">
        <div className="text-xs font-black uppercase tracking-widest text-muted-foreground mr-1">
          Cutoff Filter
        </div>
        
        <select 
          value={selectedYear} 
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="h-9 px-3 rounded-xl border border-input bg-background text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
        >
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className="h-9 px-3 rounded-xl border border-input bg-background text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
        >
          {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
            <option key={i} value={i}>{m}</option>
          ))}
        </select>
        
        <select
          value={selectedCutoff}
          onChange={(e) => setSelectedCutoff(Number(e.target.value) as 1 | 2)}
          className="h-9 px-3 rounded-xl border border-input bg-background text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-sm cursor-pointer"
        >
          <option value={1}>1st Cutoff (26th - 10th)</option>
          <option value={2}>2nd Cutoff (11th - 25th)</option>
        </select>

        {/* ── Department Filter ────────────────────────────────────────────── */}
        {(isHRHead || departments.length > 1) && departments.length > 0 && (
          <>
            <div className="h-6 w-px bg-border/60 mx-1" />
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Department</span>
            </div>
            <Combobox
              value={departments.find(d => d.department_id === selectedDepartmentId)?.department_name ?? ""}
              onValueChange={(val) => {
                const dept = departments.find(d => d.department_name === val);
                setSelectedDepartmentId(dept?.department_id);
              }}
            >
              <ComboboxInput
                className="h-9 w-56 rounded-xl border-amber-300/50 bg-amber-50/50 text-xs font-semibold text-amber-800 focus-visible:ring-amber-400 cursor-pointer"
                placeholder="All Departments"
                showClear={!!selectedDepartmentId}
                readOnly
              />
              <ComboboxContent>
                <ComboboxList>
                  <ComboboxEmpty>No department found.</ComboboxEmpty>
                  <ComboboxItem value="">All Departments</ComboboxItem>
                  {departments.map((d) => (
                    <ComboboxItem key={d.department_id} value={d.department_name}>
                      {d.department_name}
                    </ComboboxItem>
                  ))}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </>
        )}

        <Button size="sm" onClick={applyFilter} className="h-9 px-4 rounded-xl text-xs font-bold shadow-sm">
          Apply Filter
        </Button>
        
        {isFilterActive && (
          <Button size="sm" variant="ghost" onClick={clearFilter} className="h-9 px-3 rounded-xl text-xs font-bold text-muted-foreground hover:text-destructive">
            <FilterX className="h-3.5 w-3.5 mr-1.5" /> Clear
          </Button>
        )}
      </div>

      {/* ── 3 Request Type Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <RequestTypeCard
          type="leave"
          icon={Calendar}
          label="Leave"
          description="Vacation, sick, emergency & other leave"
          pendingCount={leave.filter(r => r.status === "pending").length}
          isLoading={isLoading}
          onClick={() => setActiveModal("leave")}
        />
        <RequestTypeCard
          type="overtime"
          icon={Clock}
          label="Overtime"
          description="Extended work hours beyond schedule"
          pendingCount={overtime.filter(r => r.status === "pending").length}
          isLoading={isLoading}
          onClick={() => setActiveModal("overtime")}
        />
        <RequestTypeCard
          type="undertime"
          icon={RotateCcw}
          label="Undertime"
          description="Early departure from scheduled shift"
          pendingCount={undertime.filter(r => r.status === "pending").length}
          isLoading={isLoading}
          onClick={() => setActiveModal("undertime")}
        />
      </div>

      <ApprovalHistoryLog
        logs={approvalLogs}
        isLoading={isLogsLoading}
        onRefresh={refreshLogs}
      />

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {(["leave", "overtime", "undertime"] as RequestType[]).map((type) => (
        <RequestTypeModal
          key={type}
          open={activeModal === type}
          onOpenChange={(v) => setActiveModal(v ? type : null)}
          type={type}
          requests={
            type === "leave" ? leave :
            type === "overtime" ? overtime :
            undertime
          }
          onAction={handleAction}
          isActing={isActing}
          isHRHead={isHRHead}
        />
      ))}
    </div>
  );
}
