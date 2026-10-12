"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, RotateCw, FilterX } from "lucide-react";
import { CSC_LEAVE_TYPES } from "../types";

interface LguLeaveFiltersProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  leaveTypeFilter: string;
  onLeaveTypeChange: (val: string) => void;
  statusFilter: string;
  onStatusChange: (val: string) => void;
  onRefresh: () => void;
  onReset: () => void;
  isRefreshing?: boolean;
}

export function LguLeaveFilters({
  searchQuery,
  onSearchChange,
  leaveTypeFilter,
  onLeaveTypeChange,
  statusFilter,
  onStatusChange,
  onRefresh,
  onReset,
  isRefreshing,
}: LguLeaveFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border shadow-xs">
      <div className="flex flex-1 flex-col sm:flex-row items-center gap-2">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employee, position, office..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-9 text-xs"
          />
        </div>

        {/* Leave Type Select */}
        <Select value={leaveTypeFilter} onValueChange={onLeaveTypeChange}>
          <SelectTrigger className="w-full sm:w-56 h-9 text-xs">
            <SelectValue placeholder="All Statutory Leave Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Leave Types</SelectItem>
            {CSC_LEAVE_TYPES.map((t) => (
              <SelectItem key={t.code} value={t.code}>
                {t.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Select */}
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="w-full sm:w-44 h-9 text-xs">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="recommended">Recommended</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="disapproved">Disapproved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="h-9 text-xs gap-1"
        >
          <FilterX className="h-3.5 w-3.5" />
          Reset
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-9 text-xs gap-1"
        >
          <RotateCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
    </div>
  );
}
