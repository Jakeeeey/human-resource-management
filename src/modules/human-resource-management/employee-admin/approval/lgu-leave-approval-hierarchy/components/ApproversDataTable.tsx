"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Building2,
  FilterX,
  Layers,
} from "lucide-react";
import {
  LguLeaveApprover,
  DepartmentInfo,
} from "../types";

interface ApproversDataTableProps {
  approvers: LguLeaveApprover[];
  departments: DepartmentInfo[];
  selectedDepartmentId: string;
  onSelectDepartment: (id: string) => void;
  selectedLevel: string;
  onSelectLevel: (lvl: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onAddApprover: () => void;
  onEditApprover: (approver: LguLeaveApprover) => void;
  onDeleteApprover: (approver: LguLeaveApprover) => void;
  onResetFilters: () => void;
}

export function ApproversDataTable({
  approvers,
  departments,
  selectedDepartmentId,
  onSelectDepartment,
  selectedLevel,
  onSelectLevel,
  searchQuery,
  onSearchChange,
  onAddApprover,
  onEditApprover,
  onDeleteApprover,
  onResetFilters,
}: ApproversDataTableProps) {
  const getLevelBadge = (level: number) => {
    switch (level) {
      case 1:
        return (
          <Badge
            variant="outline"
            className="text-xs font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-400/30"
          >
            Level 1: Supervisor (7.B)
          </Badge>
        );
      case 2:
        return (
          <Badge
            variant="outline"
            className="text-xs font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-400/30"
          >
            Level 2: HRMO (7.A)
          </Badge>
        );
      case 3:
        return (
          <Badge
            variant="outline"
            className="text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-400/30"
          >
            Level 3: Mayor / Head (7.C)
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            Level {level}
          </Badge>
        );
    }
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    selectedDepartmentId !== "all" ||
    selectedLevel !== "all";

  return (
    <div className="border rounded-xl bg-card shadow-xs overflow-hidden space-y-4 p-4 sm:p-5">
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by approver, role, position, or department..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Department Filter */}
          <Select
            value={selectedDepartmentId}
            onValueChange={onSelectDepartment}
          >
            <SelectTrigger className="w-full sm:w-[200px] h-9 text-xs">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All Departments
              </SelectItem>
              {departments.map((d) => (
                <SelectItem
                  key={d.department_id}
                  value={String(d.department_id)}
                  className="text-xs"
                >
                  {d.department_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Level Filter */}
          <Select value={selectedLevel} onValueChange={onSelectLevel}>
            <SelectTrigger className="w-full sm:w-[170px] h-9 text-xs">
              <SelectValue placeholder="All Levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All Approval Levels
              </SelectItem>
              <SelectItem value="1" className="text-xs">
                Level 1: Recommender
              </SelectItem>
              <SelectItem value="2" className="text-xs">
                Level 2: HR Certifier
              </SelectItem>
              <SelectItem value="3" className="text-xs">
                Level 3: Head / Mayor
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
              title="Reset all filters"
            >
              <FilterX className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Primary Action */}
        <Button
          size="sm"
          className="h-9 text-xs font-semibold gap-1.5 shadow-xs"
          onClick={onAddApprover}
        >
          <Plus className="h-4 w-4" />
          Assign New Approver
        </Button>
      </div>

      {/* Approvers Table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="text-xs font-bold text-foreground">
                Approver Officer
              </TableHead>
              <TableHead className="text-xs font-bold text-foreground">
                Assigned Department
              </TableHead>
              <TableHead className="text-xs font-bold text-foreground">
                Hierarchy Level & CSC Role
              </TableHead>
              <TableHead className="text-xs font-bold text-foreground">
                Position / Designation
              </TableHead>
              <TableHead className="text-xs font-bold text-foreground">
                Created
              </TableHead>
              <TableHead className="text-xs font-bold text-foreground text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {approvers.length > 0 ? (
              approvers.map((approver) => (
                <TableRow key={approver.id} className="hover:bg-muted/30">
                  {/* Approver Profile */}
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                        {approver.approver_name
                          .split(" ")
                          .map((n) => n[0])
                          .filter(Boolean)
                          .slice(0, 2)
                          .join("")
                          .toUpperCase() || "A"}
                      </div>
                      <div>
                        <p className="font-bold text-xs text-foreground">
                          {approver.approver_name}
                        </p>
                        {approver.approver_email && (
                          <p className="text-[11px] text-muted-foreground">
                            {approver.approver_email}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Department */}
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span>{approver.department_name}</span>
                    </div>
                  </TableCell>

                  {/* Level Badge */}
                  <TableCell>{getLevelBadge(approver.level)}</TableCell>

                  {/* Position */}
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {approver.approver_position}
                    </span>
                  </TableCell>

                  {/* Created Date */}
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {approver.created_at
                        ? new Date(approver.created_at).toLocaleDateString()
                        : "Active"}
                    </span>
                  </TableCell>

                  {/* Action Buttons */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => onEditApprover(approver)}
                        title="Edit Assignment"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-rose-600"
                        onClick={() => onDeleteApprover(approver)}
                        title="Delete Assignment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Layers className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm font-semibold text-foreground">
                      No Approver Assignments Found
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      {hasActiveFilters
                        ? "Try clearing or adjusting your search or filters."
                        : "Start by assigning approvers for each department's 3-level approval hierarchy."}
                    </p>
                    {hasActiveFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onResetFilters}
                        className="mt-2 text-xs"
                      >
                        Clear Filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
