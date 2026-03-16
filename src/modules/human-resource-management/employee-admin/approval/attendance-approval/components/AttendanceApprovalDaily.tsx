"use client";

import React, { useState, useEffect } from "react";
import { format, addDays, subDays } from "date-fns";
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Save, 
  Calendar as CalendarIcon,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AttendanceTable } from "./AttendanceTable";
import { 
  fetchAttendanceRequests, 
  approveOrRejectAttendance, 
  fetchDepartments 
} from "../providers/fetchProvider";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import type { AttendanceLogWithUser } from "../type";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function AttendanceApprovalDaily() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [logs, setLogs] = useState<AttendanceLogWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [departments, setDepartments] = useState<{ department_id: number, department_name: string }[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState("all");

  const loadLogs = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const response = await fetchAttendanceRequests({ 
        startDate: dateStr, 
        endDate: dateStr,
        departmentId: selectedDeptId
      });
      setLogs(response.data || []);
    } catch {
      toast.error("Failed to load attendance logs");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, selectedDeptId]);

  useEffect(() => {
    const getDepts = async () => {
      try {
        const data = await fetchDepartments();
        setDepartments(data);
      } catch (e) {
        console.error("Failed to fetch departments", e);
      }
    };
    getDepts();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [selectedDate, selectedDeptId, loadLogs]);

  const handlePrevDate = () => setSelectedDate(prev => subDays(prev, 1));
  const handleNextDate = () => setSelectedDate(prev => addDays(prev, 1));

  const filteredLogs = logs.filter(log => 
    `${log.user_fname} ${log.user_lname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.user_id.toString().includes(searchTerm)
  );

  const handleUpdateRow = (logId: number, field: string, value: string | number | null) => {
    setLogs(prev => prev.map(log => 
      log.log_id === logId ? { ...log, [field]: value } : log
    ));
  };

  const handleSaveRow = async (log: AttendanceLogWithUser) => {
    try {
      setIsProcessing(true);
      console.log(`[FRONTEND] Saving row for user ${log.user_id} on ${log.log_date}`, log);
      await approveOrRejectAttendance({
        log_id: log.log_id,
        employee_id: log.user_id,
        date_schedule: log.log_date,
        status: log.approval_status || "pending",
        remarks: log.status || "",
        work_minutes: log.work_minutes,
        late_minutes: log.late_minutes,
        undertime_minutes: log.undertime_minutes,
        overtime_minutes: log.overtime_minutes
      });
      toast.success(`Saved changes for ${log.user_fname}`);
      // Refresh logs in background without hiding table
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const response = await fetchAttendanceRequests({ 
        startDate: dateStr, 
        endDate: dateStr,
        departmentId: selectedDeptId
      });
      setLogs(response.data || []);
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveAll = async () => {
    try {
      if (filteredLogs.length === 0) return;
      
      setIsProcessing(true);
      toast.info("Saving all changes...");
      
      const updates = filteredLogs.map(log => ({
        log_id: log.log_id,
        employee_id: log.user_id,
        date_schedule: log.log_date,
        status: log.approval_status || "pending",
        remarks: log.status || "",
        work_minutes: log.work_minutes,
        late_minutes: log.late_minutes,
        undertime_minutes: log.undertime_minutes,
        overtime_minutes: log.overtime_minutes
      }));
      
      await approveOrRejectAttendance(updates);
      toast.success("All changes saved successfully");
      loadLogs();
    } catch {
      toast.error("Failed to save some changes");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Filters & Actions Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card/50 p-4 rounded-2xl border border-border/50 backdrop-blur-sm shadow-sm">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-background rounded-xl border p-1 shadow-inner">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handlePrevDate}
              className="h-8 w-8 rounded-lg hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="flex items-center gap-2 px-3 min-w-[160px] justify-center font-bold text-sm text-primary hover:bg-primary/5 rounded-lg transition-all"
                >
                  <CalendarIcon className="h-4 w-4 opacity-70" />
                  {format(selectedDate, "MMM dd, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl shadow-foreground/10" align="center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  month={selectedDate}
                  onMonthChange={setSelectedDate}
                  initialFocus
                  className="rounded-2xl bg-background/95 backdrop-blur-xl"
                />
              </PopoverContent>
            </Popover>

            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleNextDate}
              className="h-8 w-8 rounded-lg hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="w-56">
            <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
              <SelectTrigger className="rounded-xl border-muted-foreground/20 bg-background/50 h-10">
                <Filter className="mr-2 h-4 w-4 text-primary/60" />
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border shadow-2xl max-h-[300px]">
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.department_id} value={dept.department_id.toString()}>
                    {dept.department_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name / id"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 rounded-xl border-muted-foreground/20 bg-background/50 focus-visible:ring-primary/20 h-10"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button 
            onClick={handleSaveAll}
            disabled={isLoading || isProcessing || filteredLogs.length === 0}
            className="w-full md:w-auto rounded-xl bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 h-10 px-6 active:scale-95 transition-all text-white"
          >
            <Save className={cn("mr-2 h-4 w-4", isProcessing && "animate-spin")} />
            {isProcessing ? "Saving..." : "Save All Changes"}
          </Button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-card rounded-2xl border shadow-xl shadow-foreground/5 overflow-hidden transition-all duration-300">
        <AttendanceTable 
          data={filteredLogs}
          onUpdateRow={handleUpdateRow}
          onSaveRow={handleSaveRow}
          onApprove={async (log, remarks) => {
             await approveOrRejectAttendance({
                log_id: log.log_id,
                employee_id: log.user_id,
                date_schedule: log.log_date,
                status: "approved",
                remarks,
                work_minutes: log.work_minutes,
                late_minutes: log.late_minutes,
                undertime_minutes: log.undertime_minutes,
                overtime_minutes: log.overtime_minutes
             });
             toast.success("Approved");
             loadLogs();
          }}
          onReject={async (log, remarks) => {
             await approveOrRejectAttendance({
                log_id: log.log_id,
                employee_id: log.user_id,
                date_schedule: log.log_date,
                status: "rejected",
                remarks,
                work_minutes: log.work_minutes,
                late_minutes: log.late_minutes,
                undertime_minutes: log.undertime_minutes,
                overtime_minutes: log.overtime_minutes
             });
             toast.success("Rejected");
             loadLogs();
          }}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
