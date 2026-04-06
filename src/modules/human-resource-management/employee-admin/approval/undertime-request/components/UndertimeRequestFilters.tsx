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

// ============================================================================
// PROPS
// ============================================================================

interface UndertimeRequestFiltersProps {
  searchQuery: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  nameFilter: string | null;
  employeeNames: string[];
  onSearchChange: (query: string) => void;
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
  onNameFilterChange: (name: string | null) => void;
  onResetFilters: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function UndertimeRequestFilters({
  searchQuery,
  dateFrom,
  dateTo,
  nameFilter,
  employeeNames,
  onSearchChange,
  onDateFromChange,
  onDateToChange,
  onNameFilterChange,
  onResetFilters,
}: UndertimeRequestFiltersProps) {
  const hasActiveFilters =
    searchQuery ||
    dateFrom ||
    dateTo ||
    nameFilter !== null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search Bar */}
      <div className="relative w-62.5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, purpose..."
          value={searchQuery}
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
              !dateFrom && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {dateFrom ? (
              <span className="truncate">{format(dateFrom, "MMM d, yyyy")}</span>
            ) : (
              <span>From date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateFrom}
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
              !dateTo && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {dateTo ? (
              <span className="truncate">{format(dateTo, "MMM d, yyyy")}</span>
            ) : (
              <span>To date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateTo}
            onSelect={onDateToChange}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {/* Name Filter */}
      <Select
        value={nameFilter !== null ? nameFilter : "all"}
        onValueChange={(value) =>
          onNameFilterChange(value === "all" ? null : value)
        }
      >
        <SelectTrigger className="w-42.5">
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
