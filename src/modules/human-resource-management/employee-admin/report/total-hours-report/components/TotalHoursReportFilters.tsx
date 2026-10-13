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
import {
  CalendarIcon,
  Search,
  RotateCcw,
  Building2,
  User,
  Filter,
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Department, TotalHoursReportFilters as FiltersType, DateRangePreset } from "../type";
import { SearchableDropdown } from "./SearchableDropdown";

interface TotalHoursReportFiltersProps {
  filters: FiltersType;
  departments: Department[];
  employeeNames: string[];
  isHRAdmin: boolean;
  onSearchChange: (query: string) => void;
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
  onDateRangePreset: (preset: DateRangePreset) => void;
  onNavigateWeek?: (direction: "prev" | "next") => void;
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
  onNavigateWeek,
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

  const handleClearSearch = () => {
    setLocalSearch("");
    onSearchChange("");
  };

  const hasActiveFilters = Boolean(
    filters.searchQuery ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.departmentId !== null ||
      filters.nameFilter !== null ||
      filters.approvalStatus !== "approved"
  );

  // Department options for SearchableDropdown
  const departmentOptions = React.useMemo(() => {
    return departments.map((d) => ({
      value: String(d.department_id),
      label: d.department_name,
    }));
  }, [departments]);

  // Employee options for SearchableDropdown
  const employeeOptions = React.useMemo(() => {
    return employeeNames.map((name) => ({
      value: name,
      label: name,
    }));
  }, [employeeNames]);

  return (
    <div className="space-y-3.5">
      {/* Top row: Quick Date Presets Chips */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-semibold text-muted-foreground mr-1 flex items-center gap-1.5 shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Presets:</span>
        </span>

        {/* Priority Cutoffs */}
        <Button
          variant="outline"
          size="xs"
          className="h-7 px-2.5 rounded-full text-xs font-semibold bg-primary/10 border-primary/30 hover:bg-primary/20 text-primary transition-all shadow-2xs"
          onClick={() => onDateRangePreset("cutoff_26_10")}
        >
          Cutoff (26–10)
        </Button>
        <Button
          variant="outline"
          size="xs"
          className="h-7 px-2.5 rounded-full text-xs font-semibold bg-primary/10 border-primary/30 hover:bg-primary/20 text-primary transition-all shadow-2xs"
          onClick={() => onDateRangePreset("cutoff_11_25")}
        >
          Cutoff (11–25)
        </Button>

        <div className="hidden sm:inline-block h-3.5 w-px bg-border mx-0.5" />

        <Button
          variant="outline"
          size="xs"
          className="h-7 px-2.5 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          onClick={() => onDateRangePreset("this_week")}
        >
          This Week
        </Button>
        <Button
          variant="outline"
          size="xs"
          className="h-7 px-2.5 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          onClick={() => onDateRangePreset("last_week")}
        >
          Last Week
        </Button>
        <Button
          variant="outline"
          size="xs"
          className="h-7 px-2.5 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          onClick={() => onDateRangePreset("this_month")}
        >
          This Month
        </Button>
        <Button
          variant="outline"
          size="xs"
          className="h-7 px-2.5 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          onClick={() => onDateRangePreset("last_month")}
        >
          Last Month
        </Button>
      </div>

      {/* Main Filter Controls Row */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Search Bar with instant Clear Button */}
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search employee, ID, position..."
            value={localSearch}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            className="pl-9 pr-8 h-9 text-xs sm:text-sm bg-background border-input shadow-2xs"
          />
          {localSearch && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full transition-colors"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Date Range: From Date */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 min-w-[136px] justify-start text-left font-normal text-xs sm:text-sm shadow-2xs px-3",
                !filters.dateFrom && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {filters.dateFrom ? (
                  format(filters.dateFrom, "MMM dd, yyyy")
                ) : (
                  "From Date"
                )}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 shadow-lg border-border" align="start">
            <Calendar
              mode="single"
              selected={filters.dateFrom}
              onSelect={onDateFromChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Date Range: To Date */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 min-w-[136px] justify-start text-left font-normal text-xs sm:text-sm shadow-2xs px-3",
                !filters.dateTo && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {filters.dateTo ? (
                  format(filters.dateTo, "MMM dd, yyyy")
                ) : (
                  "To Date"
                )}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 shadow-lg border-border" align="start">
            <Calendar
              mode="single"
              selected={filters.dateTo}
              onSelect={onDateToChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Quick Week Steppers */}
        {onNavigateWeek && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground shadow-2xs"
              onClick={() => onNavigateWeek("prev")}
              title="Previous Week (-7 days)"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground shadow-2xs"
              onClick={() => onNavigateWeek("next")}
              title="Next Week (+7 days)"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Department Searchable Dropdown */}
        <div className="min-w-[190px] max-w-[240px]">
          <SearchableDropdown
            options={departmentOptions}
            value={filters.departmentId !== null ? String(filters.departmentId) : "all"}
            onValueChange={(val) =>
              onDepartmentChange(val === "all" ? null : Number(val))
            }
            allOptionLabel={isHRAdmin ? "All Departments" : "Authorized Departments"}
            searchPlaceholder="Search department..."
            placeholder="All Departments"
            icon={<Building2 className="h-4 w-4 text-muted-foreground shrink-0" />}
            className="w-full shadow-2xs"
            popoverWidth="w-[280px]"
          />
        </div>

        {/* Employee Searchable Dropdown */}
        {employeeNames.length > 0 && (
          <div className="min-w-[190px] max-w-[240px]">
            <SearchableDropdown
              options={employeeOptions}
              value={filters.nameFilter || "all"}
              onValueChange={(val) =>
                onNameFilterChange(val === "all" ? null : val)
              }
              allOptionLabel="All Employees"
              searchPlaceholder="Search employee name..."
              placeholder="All Employees"
              icon={<User className="h-4 w-4 text-muted-foreground shrink-0" />}
              className="w-full shadow-2xs"
              popoverWidth="w-[280px]"
            />
          </div>
        )}

        {/* Approval Status Select */}
        <div className="min-w-[160px]">
          <Select
            value={filters.approvalStatus}
            onValueChange={onApprovalStatusChange}
          >
            <SelectTrigger className="h-9 text-xs sm:text-sm shadow-2xs whitespace-nowrap">
              <div className="flex items-center min-w-0 mr-1 truncate">
                <Filter className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Approval Status" />
              </div>
            </SelectTrigger>
            <SelectContent className="shadow-lg border-border">
              <SelectItem value="approved" className="text-xs sm:text-sm font-medium">
                Approved Only
              </SelectItem>
              <SelectItem value="all" className="text-xs sm:text-sm">
                All Statuses
              </SelectItem>
              <SelectItem value="pending" className="text-xs sm:text-sm">
                Pending Only
              </SelectItem>
              <SelectItem value="rejected" className="text-xs sm:text-sm">
                Rejected
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reset Filter Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground font-medium gap-1.5 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Reset</span>
          </Button>
        )}
      </div>
    </div>
  );
}
