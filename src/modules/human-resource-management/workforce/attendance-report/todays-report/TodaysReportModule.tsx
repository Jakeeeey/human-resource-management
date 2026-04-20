"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Users, UserX, CalendarCheck, AlarmClock, Download } from "lucide-react";
import { useAttendance } from "./hooks/useAttendance";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { LiveClock }           from "./components/LiveClock";
import { MetricCard }          from "./components/MetricCards";
import { PunctualityPieChart } from "./components/PunctualityPieChart";
import { DepartmentBarChart }  from "./components/DepartmentBarChart";
import { TimeLogsTable }       from "./components/TimeLogsTable";
import { applyFilters }        from "./utils";
import { exportAttendancePDF } from "./utils/exportAttendancePDF";

type AttendanceRecord = Record<string, unknown>;

function PageSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex justify-between"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-16 w-48" /></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function TodaysReportModule() {
  const todayStr = new Date().toISOString().split("T")[0];
  const { loading, error, records, departments, summary, refetch } = useAttendance(todayStr);
  const toastIdRef = useRef<string | number | null>(null);
  const mountedRef = useRef(true);

  const [statusFilter,      setStatusFilter]      = useState("All");
  const [punctualityFilter, setPunctualityFilter] = useState("All");
  const [deptFilter,        setDeptFilter]        = useState("All");
  const [search,            setSearch]            = useState("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!mountedRef.current) return;
    
    if (loading) {
      if (!toastIdRef.current) {
        toastIdRef.current = toast.loading("Fetching attendance data...");
      }
    } else if (toastIdRef.current) {
      const currentId = toastIdRef.current;
      toast.dismiss(currentId);
      toastIdRef.current = null;
      
      if (error) {
        toast.error(`Error: ${error}`);
      } else if (records.length > 0) {
        toast.success(`Loaded ${records.length} attendance records`);
      }
    }
  }, [loading, error, records.length]);


  const isFiltered = statusFilter !== "All" || punctualityFilter !== "All" || deptFilter !== "All" || search !== "";
  const filtered = useMemo(() =>
    applyFilters(records, { statusFilter, punctualityFilter, deptFilter, search }),
    [records, statusFilter, punctualityFilter, deptFilter, search]
  );
  const chartRecords = isFiltered ? filtered : records;
  const clearFilters = () => {
    setStatusFilter("All"); setPunctualityFilter("All");
    setDeptFilter("All"); setSearch("");
  };
  if (loading) return <PageSkeleton />;

  if (error) return (
    <div className="p-8 text-center m-8 border border-red-500/20 bg-red-500/5 rounded-lg">
      <p className="text-red-500 font-medium">Error: {error}</p>
      <Button variant="outline" className="mt-4" onClick={refetch}>Retry</Button>
    </div>
  );

  return (
    <>
      <div className="p-4 md:p-6 bg-background text-foreground min-h-screen space-y-6 w-full box-border overflow-hidden">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Attendance Report</h1>
            <p className="text-sm text-muted-foreground mt-1">Daily employee attendance and time logs</p>
          </div>
          <LiveClock />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full min-w-0">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent>
              {["All","Present","Absent","Rest Day"].map((s) => (
                <SelectItem key={s} value={s} className="text-xs">{s === "All" ? "All Statuses" : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={punctualityFilter} onValueChange={setPunctualityFilter}>
            <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue placeholder="All Punctuality" /></SelectTrigger>
            <SelectContent>
              {["All","On Time","Late"].map((s) => (
                <SelectItem key={s} value={s} className="text-xs">{s === "All" ? "All Punctuality" : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="h-9 w-[170px] text-xs"><SelectValue placeholder="All Departments" /></SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="All" className="text-xs text-muted-foreground">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.department_id} value={d.department_name} className="text-xs">{d.department_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-[220px] text-xs"
          />
          {isFiltered && (
            <Button variant="ghost" size="sm" onClick={clearFilters}
              className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5">
              ✕ Clear
            </Button>
          )}
          {isFiltered && (
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filtered.length}</span> of{" "}
              <span className="font-semibold text-foreground">{records.length}</span> records
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 text-xs gap-1.5 ml-auto"
            onClick={() => exportAttendancePDF(filtered as unknown as AttendanceRecord[])}
          >
            <Download className="h-3.5 w-3.5" /> Export PDF
          </Button>
        </div>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 w-full">
          <MetricCard
            title="Present"
            value={filtered.filter((r) => r.presentStatus === "Present").length}
            sub={`${records.length} total employees`}
            icon={<Users className="h-4 w-4" />}
          />
          <MetricCard
            title="Absent"
            value={filtered.filter((r) => r.presentStatus === "Absent").length}
            sub={`${filtered.length > 0 ? ((filtered.filter((r) => r.presentStatus === "Absent").length / records.length) * 100).toFixed(1) : 0}% of total`}
            icon={<UserX className="h-4 w-4" />}
          />
          <MetricCard
            title="On Time"
            value={filtered.filter((r) => r.punctuality === "On Time").length}
            sub={`${summary.present > 0 ? ((filtered.filter((r) => r.punctuality === "On Time").length / summary.present) * 100).toFixed(1) : 0}% of present`}
            icon={<CalendarCheck className="h-4 w-4" />}
          />
          <MetricCard
            title="Late"
            value={filtered.filter((r) => r.punctuality === "Late").length}
            sub={`${summary.present > 0 ? ((filtered.filter((r) => r.punctuality === "Late").length / summary.present) * 100).toFixed(1) : 0}% of present`}
            icon={<AlarmClock className="h-4 w-4" />}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2 w-full">
          <PunctualityPieChart records={chartRecords} isFiltered={isFiltered} />
          <DepartmentBarChart  records={chartRecords} isFiltered={isFiltered} />
        </div>
        <TimeLogsTable records={filtered} total={records.length} />
      </div>
      <Toaster />
    </>
  );
}
