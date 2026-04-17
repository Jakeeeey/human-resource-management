"use client";
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { useEmployees } from "../hooks/useEmployeeReport";
import { DepartmentPieChart } from "./DepartmentPieChart";
import type { Employee } from "../hooks/useEmployeeReport";

const PAGE_SIZE = 10;

export function getInitials(fname: string, lname: string): string {
  return `${(fname[0] ?? "").toUpperCase()}${(lname[0] ?? "").toUpperCase()}`;
}

interface Props { onSelect: (e: Employee) => void }

export function EmployeeListView({ onSelect }: Props) {
  const { loading, error, employees, departments } = useEmployees();
  const [deptFilter, setDeptFilter] = useState("All");
  const [search,     setSearch]     = useState("");
  const [page,       setPage]       = useState(1);

  const filtered = useMemo(() =>
    employees.filter((e) => {
      const matchDept = deptFilter === "All" || e.department_name === deptFilter;
      const q = search.toLowerCase();
      const matchSearch = !q
        || `${e.user_fname} ${e.user_lname}`.toLowerCase().includes(q)
        || e.user_email.toLowerCase().includes(q);
      return matchDept && matchSearch;
    }),
    [employees, deptFilter, search]
  );

  // Reset page to 1 when filters change
  const filterKey = `${deptFilter}|${search}`;
  useEffect(() => {
    if (page !== 1) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const start      = (safePage - 1) * PAGE_SIZE;
  const paginated  = filtered.slice(start, start + PAGE_SIZE);

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-64 w-full" />
      <div className="space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
    </div>
  );

  if (error) return (
    <div className="p-8 text-center border border-red-500/20 bg-red-500/5 rounded-lg">
      <p className="text-red-500 font-medium">Error loading employees: {error}</p>
      <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Employee Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">View individual attendance history per employee</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Select value={deptFilter} onValueChange={(v) => { setDeptFilter(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[180px] text-xs">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="All" className="text-xs text-muted-foreground">All Departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.name} className="text-xs">{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="h-9 w-[240px] text-xs"
        />
      </div>

      <DepartmentPieChart employees={employees} />

      <Card className="shadow-none border-border overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-3">
          <CardTitle className="text-sm font-bold uppercase flex items-center gap-2">
            <Users className="h-4 w-4" /> Employees ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-bold py-4 pl-6">Employee</TableHead>
                <TableHead className="text-xs font-bold py-4">Department</TableHead>
                <TableHead className="text-xs font-bold py-4 pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-10 text-muted-foreground text-sm">
                    No employees found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : paginated.map((emp) => (
                <TableRow key={emp.user_id} className="border-border/40 hover:bg-muted/20">
                  <TableCell className="py-4 pl-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                        {getInitials(emp.user_fname, emp.user_lname)}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-foreground">{emp.user_fname} {emp.user_lname}</div>
                        <div className="text-[11px] text-muted-foreground">{emp.user_position}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground py-4">{emp.department_name}</TableCell>
                  <TableCell className="py-4 pr-6 text-right">
                    <Button size="sm" className="h-8 px-3 text-xs gap-1.5" onClick={() => onSelect(emp)}>
                      <Eye className="h-3.5 w-3.5" /> View Attendance
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="px-6 py-3 border-t border-border/50 flex items-center justify-between gap-4 flex-wrap">
            <span className="text-xs text-muted-foreground">
              Showing {filtered.length === 0 ? 0 : start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                onClick={() => setPage((p) => p - 1)} disabled={safePage === 1}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs font-medium text-foreground min-w-[60px] text-center">
                Page {safePage} / {totalPages}
              </span>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                onClick={() => setPage((p) => p + 1)} disabled={safePage === totalPages}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default EmployeeListView;
