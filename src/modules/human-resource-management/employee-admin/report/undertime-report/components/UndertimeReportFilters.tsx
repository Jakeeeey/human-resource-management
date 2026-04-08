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
import { CalendarIcon, Search, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Department, UndertimeReportFilters } from "../type";

// ============================================================================
// PROPS
// ============================================================================

interface UndertimeReportFiltersProps {
  filters: UndertimeReportFilters;
  departments: Department[];
  isHRAdmin: boolean;
  employeeNames: string[];
  onSearchChange: (query: string) => void;
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
  onDepartmentChange: (id: number | null) => void;
  onNameFilterChange: (name: string | null) => void;
  onStatusChange: (status: string | null) => void;
  onResetFilters: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function UndertimeReportFilters({
  filters,
  departments,
  isHRAdmin,
  employeeNames,
  onSearchChange,
  onDateFromChange,
  onDateToChange,
  onDepartmentChange,
  onNameFilterChange,
  onStatusChange,
  onResetFilters,
}: UndertimeReportFiltersProps) {
  const hasActiveFilters =
    filters.searchQuery ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.departmentId !== null ||
    filters.nameFilter !== null ||
    filters.statusFilter !== null;

  return (
    <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap">
      {/* Search Bar */}
      <div className="relative w-55">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, reason..."
          value={filters.searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Date From */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[140px] justify-start text-left font-normal",
              !filters.dateFrom && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {filters.dateFrom ? (
              <span className="truncate">{format(filters.dateFrom, "MMM d, yyyy")}</span>
            ) : (
              <span>From date</span>
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
            className={cn(
              "w-[140px] justify-start text-left font-normal",
              !filters.dateTo && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {filters.dateTo ? (
              <span className="truncate">{format(filters.dateTo, "MMM d, yyyy")}</span>
            ) : (
              <span>To date</span>
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

      {/* Department Filter (HR Admin Only) */}
      {isHRAdmin && (
        <Select
          value={
            filters.departmentId !== null
              ? String(filters.departmentId)
              : "all"
          }
          onValueChange={(value) =>
            onDepartmentChange(value === "all" ? null : Number(value))
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
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
      )}

      {/* Name Filter */}
      <Select
        value={filters.nameFilter !== null ? filters.nameFilter : "all"}
        onValueChange={(value) =>
          onNameFilterChange(value === "all" ? null : value)
        }
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="All Employees" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Employees</SelectItem>
          {employeeNames.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <Select
        value={filters.statusFilter !== null ? filters.statusFilter : "all"}
        onValueChange={(value) =>
          onStatusChange(value === "all" ? null : value)
        }
      >
        <SelectTrigger className="w-35">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <Button variant="outline" size="sm" onClick={onResetFilters}>
          <X className="mr-2 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
