"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useScmFilters } from "@/modules/human-resource-management/employee-admin/administrator/providers/ScmFilterProvider";
import { ScmDateRangePicker } from "@/modules/human-resource-management/employee-admin/administrator/components/shared/ScmDateRangePicker";

interface ScmAdvancedFiltersProps {
  suppliers: string[];
  branches?: string[];
  departments?: { id: number | string; name: string }[];
  showBranch?: boolean;
  showRiskStatus?: boolean;
  showDepartment?: boolean;
  showSupplier?: boolean;
  showDateRange?: boolean;
}

/**
 * ScmAdvancedFilters
 * A centralized filtering component for SCM modules.
 * Groups date range, supplier, and branch filters into a single responsive layout.
 */
export function ScmAdvancedFilters({
  suppliers,
  branches = [],
  departments = [],
  showBranch = false,
  showRiskStatus = false,
  showDepartment = false,
  showSupplier = true,
  showDateRange = true,
}: ScmAdvancedFiltersProps) {
  const {
    dateRange,
    setDateRange,
    selectedSupplier,
    setSelectedSupplier,
    selectedBranch,
    setSelectedBranch,
    selectedRiskStatus,
    setSelectedRiskStatus,
    selectedDepartment,
    setSelectedDepartment
  } = useScmFilters();

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Date Range Filtering */}
      {showDateRange && (
        <ScmDateRangePicker date={dateRange} onDateChange={setDateRange} />
      )}

      {/* Supplier Filtering */}
      {showSupplier && (
        <div className="flex items-center gap-2">
          <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Branch Filtering */}
      {showBranch && (
        <div className="flex items-center gap-2">
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Risk Status Filtering */}
      {showRiskStatus && (
        <div className="flex items-center gap-2">
          <Select value={selectedRiskStatus} onValueChange={setSelectedRiskStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Risk Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="healthy">Healthy</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Department Filtering */}
      {showDepartment && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Filter by Department:</span>
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id.toString()}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
