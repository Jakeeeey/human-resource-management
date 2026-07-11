"use client";

import { SingleDatePicker } from "@/modules/human-resource-management/employee-admin/structrure/department/components/SingleDatePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, FileText, List } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Department {
  department_id: number;
  department_name: string;
}

interface TopsheetFiltersProps {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  departmentId: string;
  departments: Department[];
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
  onDepartmentChange: (id: string) => void;
  onExport: (type: "both" | "topsheet" | "reasons") => void;
  isExporting: boolean;
}

export function TopsheetFilters({
  dateFrom,
  dateTo,
  departmentId,
  departments,
  onDateFromChange,
  onDateToChange,
  onDepartmentChange,
  onExport,
  isExporting
}: TopsheetFiltersProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-wrap items-center gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Date From</label>
          <SingleDatePicker value={dateFrom} onChange={onDateFromChange} placeholder="Select Date" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Date To</label>
          <SingleDatePicker value={dateTo} onChange={onDateToChange} placeholder="Select Date" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Department</label>
          <Select value={departmentId} onValueChange={onDepartmentChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.department_id} value={dept.department_id.toString()}>
                  {dept.department_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={isExporting} className="gap-2">
              <Download className="h-4 w-4" />
              {isExporting ? "Exporting..." : "Export PDF"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onExport("both")} className="gap-2">
              <FileText className="h-4 w-4" />
              Topsheet & Reasons
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport("topsheet")} className="gap-2">
              <List className="h-4 w-4" />
              Topsheet Only
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport("reasons")} className="gap-2">
              <List className="h-4 w-4" />
              Reasons Only
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
