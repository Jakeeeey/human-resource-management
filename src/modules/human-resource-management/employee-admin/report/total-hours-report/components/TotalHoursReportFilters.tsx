"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, Search, RotateCcw, Building2, User, Filter } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Department, TotalHoursReportFilters as FiltersType } from "../type";

interface TotalHoursReportFiltersProps {
  filters: FiltersType;
  departments: Department[];
  employeeNames: string[];
  isHRAdmin: boolean;
  onSearchChange: (query: string) => void;
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
  onDateRangePreset: (
    preset:
      | "today"
      | "yesterday"
      | "this_week"
      | "last_week"
      | "this_month"
      | "last_month"
      | "cutoff_26_10"
      | "cutoff_11_25"
  ) => void;
  onDepartmentChange: (id: number | null) => void;
  onNameFilterChange: (name: string | null) => void;
  onApprovalStatusChange: (status: string) => void;
  onResetFilters: () => void;
}

export function TotalHoursReportFilters({
  filters,
  departments,
  employeeNames,
  isHRAdmin,
  onSearchChange,
  onDateFromChange,
  onDateToChange,
  onDateRangePreset,
  onDepartmentChange,
  onNameFilterChange,
  onApprovalStatusChange,
  onResetFilters,
}: TotalHoursReportFiltersProps) {
  const [localSearch, setLocalSearch] = React.useState(filters.searchQuery);

  React.useEffect(() => {
    setLocalSearch(filters.searchQuery);
  }, [filters.searchQuery]);

  const handleSearchInputChange = (val: string) => {
    setLocalSearch(val);
    onSearchChange(val);
  };

  const hasActiveFilters = Boolean(
    filters.searchQuery ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.departmentId !== null ||
      filters.nameFilter !== null ||
      filters.approvalStatus !== "approved"
  );

  return (
    <div className="space-y-3">
      {/* Top row: Quick Date Presets */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span className="font-medium mr-1 flex items-center gap-1">
          <CalendarIcon className="h-3.5 w-3.5" /> Date Presets:
        </span>
        <Button
          variant="outline"
          size="xs"
          className="h-7 px-2 text-xs"
          onClick={() => onDateRangePreset("today")}
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="xs"
          className="h-7 px-2 text-xs"
          onClick={() => onDateRangePreset("yesterday")}
        >
          Yesterday
        </Button>
        <Button
          variant="outline"
          size="xs"
          className="h-7 px-2 text-xs"
          onClick={() => onDateRangePreset("this_week")}
        >
          This Week
        </Button>
        <Button
          variant="outline"
          size="xs"
          className="h-7 px-2 text-xs"
          onClick={() => onDateRangePreset("last_week")}
        >
          Last Week
        </Button>
        <Button
          variant="outline"
          size="xs"
          className="h-7 px-2 text-xs"
          onClick={() => onDateRangePreset("this_month")}
        >
          This Month
        </Button>
        <Button
          variant="outline"
          size="xs"
          className="h-7 px-2 text-xs"
          onClick={() => onDateRangePreset("cutoff_26_10")}
        >
          Cutoff (26-10)
        </Button>
        <Button
          variant="outline"
          size="xs"
          className="h-7 px-2 text-xs"
          onClick={() => onDateRangePreset("cutoff_11_25")}
        >
          Cutoff (11-25)
        </Button>
      </div>

      {/* Main Filter Bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employee, ID, department..."
            value={localSearch}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* Date From */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 min-w-[130px] justify-start text-left font-normal text-xs sm:text-sm",
                !filters.dateFrom && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              {filters.dateFrom ? (
                format(filters.dateFrom, "MMM dd, yyyy")
              ) : (
                <span>From Date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateFrom}
              onSelect={onDateFromChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Date To */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 min-w-[130px] justify-start text-left font-normal text-xs sm:text-sm",
                !filters.dateTo && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              {filters.dateTo ? (
                format(filters.dateTo, "MMM dd, yyyy")
              ) : (
                <span>To Date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateTo}
              onSelect={onDateToChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Department Filter */}
        <div className="w-[170px]">
          <Select
            value={filters.departmentId !== null ? String(filters.departmentId) : "all"}
            onValueChange={(val) => onDepartmentChange(val === "all" ? null : Number(val))}
          >
            <SelectTrigger className="h-9 text-xs sm:text-sm">
              <Building2 className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {isHRAdmin ? "All Departments" : "Authorized Departments"}
              </SelectItem>
              {departments.map((dept) => (
                <SelectItem
                  key={dept.department_id}
                  value={String(dept.department_id)}
                >
                  {dept.department_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Employee Name Filter */}
        {employeeNames.length > 0 && (
          <div className="w-[170px]">
            <Select
              value={filters.nameFilter || "all"}
              onValueChange={(val) => onNameFilterChange(val === "all" ? null : val)}
            >
              <SelectTrigger className="h-9 text-xs sm:text-sm">
                <User className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                <SelectItem value="all">All Employees</SelectItem>
                {employeeNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Approval Status Filter */}
        <div className="w-[140px]">
          <Select
            value={filters.approvalStatus}
            onValueChange={onApprovalStatusChange}
          >
            <SelectTrigger className="h-9 text-xs sm:text-sm">
              <Filter className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Approval Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="approved">Approved Only</SelectItem>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending Only</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reset Filter Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
