"use client";

import React, { useState } from "react";
import { 
  Search, 
  Calendar as CalendarIcon,
  Users,
  Building2,
  ArrowRight,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Save,
  Database,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AttendanceTable } from "./AttendanceTable";
import { toast } from "sonner";
import { format, setDate, subMonths, setMonth as dateFnsSetMonth, setYear as dateFnsSetYear, getYear } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  fetchAttendanceRequests, 
  approveOrRejectAttendance,
  fetchDepartments
} from "../providers/fetchProvider";
import { AttendanceLogWithUser } from "../type";
import { EmployeeSummaryTable, EmployeeSummary } from "./EmployeeSummaryTable";

export function AttendanceApprovalCutoff() {
  const [searchTerm, setSearchTerm] = useState("");
  const [cutoff, setCutoff] = useState("26-10");
  const [month, setMonth] = useState(format(new Date(), "MMMM yyyy"));
  const [department, setDepartment] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<AttendanceLogWithUser[]>([]);
  const [departments, setDepartments] = useState<{ department_id: number, department_name: string }[]>([]);
  
  // const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // Month Picker State
  const [viewDate, setViewDate] = useState(new Date());
  
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = dateFnsSetMonth(viewDate, monthIndex);
    setMonth(format(newDate, "MMMM yyyy"));
  };

  const handleYearChange = (offset: number) => {
    setViewDate(prev => dateFnsSetYear(prev, getYear(prev) + offset));
  };

  const isSelected = (monthIndex: number) => {
     const [mName, yStr] = month.split(" ");
     return mName.startsWith(months[monthIndex]) && parseInt(yStr) === getYear(viewDate);
  };

  const getCutoffRange = () => {
    try {
      const [monthName, yearStr] = month.split(" ");
      const baseDate = new Date(`${monthName} 1, ${yearStr}`);
      
      if (cutoff === "26-10") {
        const start = setDate(subMonths(baseDate, 1), 26);
        const end = setDate(baseDate, 10);
        return { start, end };
      } else {
        const start = setDate(baseDate, 11);
        const end = setDate(baseDate, 25);
        return { start, end };
      }
    } catch {
      return { start: new Date(), end: new Date() };
    }
  };

  const { start, end } = getCutoffRange();
  // const rangeDisplay = `${format(start, "MMM dd, yyyy")} → ${format(end, "MMM dd, yyyy")}`;

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      const startDate = format(start, "yyyy-MM-dd");
      const endDate = format(end, "yyyy-MM-dd");
      const response = await fetchAttendanceRequests({ 
        startDate, 
        endDate,
        departmentId: department
      });
      setLogs(response.data || []);
      toast.success("Logs loaded successfully");
    } catch {
      toast.error("Failed to load logs");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRow = (logId: number, field: string, value: string | number | null) => {
    setLogs(prev => prev.map(log => 
      log.log_id === logId ? { ...log, [field]: value } : log
    ));
  };

  const handleSaveRow = async (log: AttendanceLogWithUser) => {
    try {
      setIsProcessing(true);
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
      // Refresh in background
      const startDate = format(start, "yyyy-MM-dd");
      const endDate = format(end, "yyyy-MM-dd");
      const response = await fetchAttendanceRequests({ 
        startDate, 
        endDate,
        departmentId: department
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
      setIsProcessing(true);
      toast.info("Saving all changes...");
      const promises = filteredLogs.map(log => 
        approveOrRejectAttendance({
          log_id: log.log_id,
          employee_id: log.user_id,
          date_schedule: log.log_date,
          status: log.approval_status || "pending",
          remarks: log.status || "",
          work_minutes: log.work_minutes,
          late_minutes: log.late_minutes,
          undertime_minutes: log.undertime_minutes,
          overtime_minutes: log.overtime_minutes
        })
      );
      await Promise.all(promises);
      toast.success("All changes saved successfully");
      loadLogs();
    } catch {
      toast.error("Failed to save some changes");
    } finally {
      setIsProcessing(false);
    }
  };

  React.useEffect(() => {
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

  const handleLoadPending = () => {
    loadLogs();
  };
  
  const handleApproveAll = async (userId: number) => {
    try {
      setIsProcessing(true);
      const employeeLogs = logs.filter(log => log.user_id === userId);
      const pendingLogs = employeeLogs.filter(log => log.approval_status === "pending" || !log.approval_status);
      
      if (pendingLogs.length === 0) {
        toast.info("No pending logs found for this employee to approve.");
        return;
      }

      toast.info(`Approving ${pendingLogs.length} pending logs for employee ${userId}...`);

      const updates = pendingLogs.map(log => ({
        log_id: log.log_id,
        employee_id: log.user_id,
        date_schedule: log.log_date,
        status: "approved" as const,
        remarks: log.status || "Batch approved",
        work_minutes: log.work_minutes,
        late_minutes: log.late_minutes,
        undertime_minutes: log.undertime_minutes,
        overtime_minutes: log.overtime_minutes
      }));

      await approveOrRejectAttendance(updates);
      toast.success(`${pendingLogs.length} logs approved successfully`);
      loadLogs();
    } catch (error) {
      console.error("Failed to approve all logs:", error);
      toast.error("Failed to approve all logs");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async (log: AttendanceLogWithUser, remarks: string) => {
    try {
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
      toast.success("Approved successfully");
      loadLogs();
    } catch {
      toast.error("Approval failed");
    }
  };

  const handleReject = async (log: AttendanceLogWithUser, remarks: string) => {
    try {
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
      toast.success("Rejected successfully");
      loadLogs();
    } catch {
      toast.error("Rejection failed");
    }
  };

  const handleBatchApprove = async (selectedLogs: AttendanceLogWithUser[]) => {
    try {
      setIsProcessing(true);
      const pendingLogs = selectedLogs.filter(log => log.approval_status === "pending" || !log.approval_status);
      
      if (pendingLogs.length === 0) {
        toast.info("No pending logs in selection to approve.");
        return;
      }

      toast.info(`Approving ${pendingLogs.length} logs...`);

      const updates = pendingLogs.map(log => ({
        log_id: log.log_id,
        employee_id: log.user_id,
        date_schedule: log.log_date,
        status: "approved" as const,
        remarks: log.status || "Batch approved",
        work_minutes: log.work_minutes,
        late_minutes: log.late_minutes,
        undertime_minutes: log.undertime_minutes,
        overtime_minutes: log.overtime_minutes
      }));

      await approveOrRejectAttendance(updates);
      toast.success(`${pendingLogs.length} logs approved successfully`);
      loadLogs();
    } catch (error) {
      console.error("Batch approval failed:", error);
      toast.error("Batch approval failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchReject = async (selectedLogs: AttendanceLogWithUser[]) => {
    try {
      setIsProcessing(true);
      const pendingLogs = selectedLogs.filter(log => log.approval_status === "pending" || !log.approval_status);
      
      if (pendingLogs.length === 0) {
        toast.info("No pending logs in selection to reject.");
        return;
      }

      toast.info(`Rejecting ${pendingLogs.length} logs...`);

      const updates = pendingLogs.map(log => ({
        log_id: log.log_id,
        employee_id: log.user_id,
        date_schedule: log.log_date,
        status: "rejected" as const,
        remarks: log.status || "Batch rejected",
        work_minutes: log.work_minutes,
        late_minutes: log.late_minutes,
        undertime_minutes: log.undertime_minutes,
        overtime_minutes: log.overtime_minutes
      }));

      await approveOrRejectAttendance(updates);
      toast.success(`${pendingLogs.length} logs rejected successfully`);
      loadLogs();
    } catch (error) {
      console.error("Batch rejection failed:", error);
      toast.error("Batch rejection failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredLogs = logs.filter(log => {
     const nameMatch = `${log.user_fname} ${log.user_lname}`.toLowerCase().includes(searchTerm.toLowerCase());
     const idMatch = log.user_id?.toString().includes(searchTerm);
     const deptMatch = department === "all" || (log.department_id && log.department_id.toString() === department);
     return (nameMatch || idMatch) && deptMatch;
  });

  // Group logs by employee
  const employeeSummaries = React.useMemo(() => {
    const summaryMap = new Map<number, EmployeeSummary>();
    
    filteredLogs.forEach(log => {
      const existing = summaryMap.get(log.user_id);
      if (existing) {
        existing.total_work_minutes += log.work_minutes || 0;
        existing.total_late_minutes += log.late_minutes || 0;
        existing.total_undertime_minutes += log.undertime_minutes || 0;
        existing.total_overtime_minutes += log.overtime_minutes || 0;
        existing.days_count += 1;
      } else {
        summaryMap.set(log.user_id, {
          user_id: log.user_id,
          user_fname: log.user_fname,
          user_lname: log.user_lname,
          department_name: log.department_name,
          total_work_minutes: log.work_minutes || 0,
          total_late_minutes: log.late_minutes || 0,
          total_undertime_minutes: log.undertime_minutes || 0,
          total_overtime_minutes: log.overtime_minutes || 0,
          days_count: 1
        });
      }
    });
    
    return Array.from(summaryMap.values());
  }, [filteredLogs]);

  const selectedEmployeeLogs = React.useMemo(() => {
    if (!selectedUserId) return [];
    return logs.filter(log => log.user_id === selectedUserId);
  }, [logs, selectedUserId]);

  const handleViewDetails = (userId: number) => {
    setSelectedUserId(userId);
  };

  const handleCloseDetails = () => {
    setSelectedUserId(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Filters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-card/50 p-6 rounded-2xl border border-border/50 backdrop-blur-sm shadow-sm">
        
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Cutoff</label>
          <Select value={cutoff} onValueChange={setCutoff}>
            <SelectTrigger className="rounded-xl border-muted-foreground/20 bg-background/50 h-11">
              <SelectValue placeholder="Select Cutoff" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border shadow-2xl">
              <SelectItem value="26-10">26 - 10</SelectItem>
              <SelectItem value="11-25">11 - 25</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Month</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full rounded-xl border-muted-foreground/20 bg-background/50 h-11 justify-between px-3 text-left font-normal hover:bg-background/80 transition-all"
              >
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-primary/60" />
                  <span className="font-bold text-foreground">{month}</span>
                </div>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4 rounded-2xl border-none shadow-2xl backdrop-blur-xl bg-background/95 shadow-foreground/10" align="start">
              <div className="space-y-4">
                {/* Year Selection */}
                <div className="flex items-center justify-between bg-muted/40 p-1.5 rounded-xl border border-border/40">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 rounded-lg hover:bg-background" 
                    onClick={() => handleYearChange(-1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-bold tracking-tight text-primary">
                    {getYear(viewDate)}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 rounded-lg hover:bg-background"
                    onClick={() => handleYearChange(1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Month Grid */}
                <div className="grid grid-cols-3 gap-2">
                  {months.map((m, idx) => (
                    <Button
                      key={m}
                      variant="ghost"
                      onClick={() => handleMonthSelect(idx)}
                      className={cn(
                        "h-10 text-xs font-bold rounded-lg transition-all duration-200",
                        isSelected(idx) 
                          ? "bg-primary text-white shadow-lg shadow-primary/30" 
                          : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      )}
                    >
                      {m}
                    </Button>
                  ))}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-[10px] uppercase tracking-wider font-bold text-primary hover:bg-primary/5"
                    onClick={() => {
                        const now = new Date();
                        setMonth(format(now, "MMMM yyyy"));
                        setViewDate(now);
                    }}
                  >
                    This Month
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-[10px] uppercase tracking-wider font-bold text-red-500 hover:bg-red-50 hover:text-red-600"
                    onClick={() => {
                        setMonth(format(new Date(), "MMMM yyyy"));
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Department</label>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="rounded-xl border-muted-foreground/20 bg-background/50 h-11">
              <Building2 className="mr-2 h-4 w-4 text-primary/60" />
              <SelectValue placeholder="Select Department" />
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

        <div className="flex flex-col gap-2">
          <Button 
            onClick={handleLoadPending}
            disabled={isLoading || isProcessing}
            className="w-full rounded-xl bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 h-11 px-6 active:scale-95 transition-all text-white font-semibold"
          >
            <Database className="mr-2 h-4 w-4" />
            Load Pending
          </Button>
          <Button 
            onClick={handleSaveAll}
            disabled={isLoading || isProcessing || filteredLogs.length === 0}
            className="w-full rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 h-11 px-6 font-bold text-white transition-all active:scale-95"
          >
            <Save className={cn("mr-2 h-4 w-4", isProcessing && "animate-spin")} />
            {isProcessing ? "Saving..." : "Save All Changes"}
          </Button>
        </div>
      </div>

      {/* Search & Meta Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-muted/30 p-4 rounded-2xl border border-dashed border-border/60">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name / id"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 rounded-xl border-muted-foreground/20 bg-background/80 focus-visible:ring-primary/20 h-10"
          />
        </div>

        <div className="flex items-center gap-3 bg-background/50 px-4 py-2 rounded-xl border border-border/40 shadow-sm">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-tighter">Cutoff Range</div>
          <div className="flex items-center gap-2 text-sm font-mono font-bold text-primary whitespace-nowrap">
            <span>{format(start, "MMM dd, yyyy")}</span>
            <ArrowRight className="h-3 w-3 opacity-50" />
            <span>{format(end, "MMM dd, yyyy")}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md ml-2 hover:bg-red-50 hover:text-red-500">
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Table Section */}
      <EmployeeSummaryTable 
        data={employeeSummaries}
        onViewDetails={handleViewDetails}
        isLoading={isLoading}
        isProcessing={isProcessing}
      />

      {/* Detail Modal (Dialog) */}
      <Dialog open={!!selectedUserId} onOpenChange={(open) => !open && handleCloseDetails()}>
        <DialogContent className="sm:max-w-[calc(100vw-540px)] w-[calc(100vw-540px)] left-[calc(50%+128px)] p-0 flex flex-col gap-0 border-none shadow-2xl overflow-hidden rounded-2xl max-h-[95vh] duration-500">
          <DialogHeader className="px-6 py-4 flex-row items-center justify-between space-y-0 border-b border-border/40 bg-muted/20">
            <div className="flex items-center gap-5">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shadow-inner">
                 <Users className="h-7 w-7 text-primary" />
              </div>
              <div className="space-y-0.5">
                <DialogTitle className="text-3xl font-black tracking-tighter text-foreground flex items-center gap-3">
                  {selectedUserId ? (
                    <>
                      <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        {logs.find(l => l.user_id === selectedUserId)?.user_fname} {logs.find(l => l.user_id === selectedUserId)?.user_lname}
                      </span>
                    </>
                  ) : "Employee Attendance"}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground font-semibold flex items-center gap-2">
                  <Badge variant="outline" className="rounded-md border-primary/20 text-primary/80 font-bold px-1.5 py-0 h-5 text-[10px] uppercase">Review Mode</Badge>
                  <span>Detailed attendance logs for the current cutoff period</span>
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-3 mr-8">
              {selectedUserId && (
                <Button
                  onClick={() => selectedUserId && handleApproveAll(selectedUserId)}
                  disabled={isProcessing}
                  className="rounded-2xl h-12 px-6 gap-2 bg-green-500 hover:bg-green-600 text-white font-bold shadow-lg shadow-green-500/20 transition-all active:scale-95"
                >
                  <Check className="h-5 w-5" />
                  Approve All for this Employee
                </Button>
              )}
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto custom-scrollbar max-h-[70vh]">
            <div className="p-8">
              <AttendanceTable 
                data={selectedEmployeeLogs}
                onUpdateRow={handleUpdateRow}
                onSaveRow={handleSaveRow}
                onApprove={handleApprove}
                onReject={handleReject}
                onBatchApprove={handleBatchApprove}
                onBatchReject={handleBatchReject}
                isLoading={isLoading}
                isProcessing={isProcessing}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
