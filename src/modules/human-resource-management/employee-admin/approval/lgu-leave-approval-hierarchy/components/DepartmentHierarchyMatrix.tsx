"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  SlidersHorizontal,
  Sparkles,
  Search,
  UserCheck,
  ShieldCheck,
  Crown,
} from "lucide-react";
import { DepartmentHierarchySummary } from "../types";

interface DepartmentHierarchyMatrixProps {
  departmentSummaries: DepartmentHierarchySummary[];
  onSetupDepartment: (summary: DepartmentHierarchySummary) => void;
  onBatchApplyStandard: () => void;
}

export function DepartmentHierarchyMatrix({
  departmentSummaries,
  onSetupDepartment,
  onBatchApplyStandard,
}: DepartmentHierarchyMatrixProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "complete" | "partial" | "empty">("all");

  const filteredDepartments = useMemo(() => {
    return departmentSummaries.filter((d) => {
      const matchesSearch = d.department.department_name
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ? true : d.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [departmentSummaries, search, statusFilter]);

  const counts = useMemo(() => {
    return {
      all: departmentSummaries.length,
      complete: departmentSummaries.filter((d) => d.status === "complete").length,
      partial: departmentSummaries.filter((d) => d.status === "partial").length,
      empty: departmentSummaries.filter((d) => d.status === "empty").length,
    };
  }, [departmentSummaries]);

  return (
    <div className="space-y-4">
      {/* Matrix Controls & Batch Banner */}
      <div className="border rounded-xl p-4 bg-card shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search departments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
              className="h-8 text-xs px-2.5 font-medium"
            >
              All ({counts.all})
            </Button>
            <Button
              variant={statusFilter === "complete" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("complete")}
              className="h-8 text-xs px-2.5 font-medium"
            >
              Complete ({counts.complete})
            </Button>
            <Button
              variant={statusFilter === "partial" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("partial")}
              className="h-8 text-xs px-2.5 font-medium"
            >
              Partial ({counts.partial})
            </Button>
            <Button
              variant={statusFilter === "empty" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("empty")}
              className="h-8 text-xs px-2.5 font-medium"
            >
              Unset ({counts.empty})
            </Button>
          </div>
        </div>

        {/* Batch Quick Action */}
        <Button
          size="sm"
          variant="outline"
          onClick={onBatchApplyStandard}
          className="h-9 text-xs font-semibold gap-1.5 border-dashed hover:border-primary hover:text-primary"
        >
          <Sparkles className="h-4 w-4 text-amber-500" />
          Batch Apply HR & Mayor
        </Button>
      </div>

      {/* Department Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredDepartments.length > 0 ? (
          filteredDepartments.map((item) => {
            const { department, level1Approver, level2Approver, level3Approver, status } = item;

            return (
              <Card
                key={department.department_id}
                className="border shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden"
              >
                <div>
                  {/* Card Header */}
                  <div className="p-4 border-b bg-muted/20 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs sm:text-sm text-foreground line-clamp-1">
                          {department.department_name}
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          {department.department_head
                            ? `Head: ${department.department_head}`
                            : `Dept ID #${department.department_id}`}
                        </p>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold shrink-0 ${
                        status === "complete"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : status === "partial"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                          : "bg-slate-500/10 text-slate-500 border-slate-500/30"
                      }`}
                    >
                      {status === "complete" ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> 3/3 Complete
                        </span>
                      ) : status === "partial" ? (
                        <span className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {item.configuredLevelsCount}/3 Levels
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> Not Configured
                        </span>
                      )}
                    </Badge>
                  </div>

                  {/* 3 Level Hierarchy Mini-List */}
                  <div className="p-4 space-y-2 text-xs">
                    {/* Level 1: Supervisor */}
                    <div
                      className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                        level1Approver
                          ? "bg-indigo-500/5 border-indigo-500/20"
                          : "border-dashed bg-muted/10 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <UserCheck
                          className={`h-4 w-4 shrink-0 ${
                            level1Approver ? "text-indigo-500" : "text-muted-foreground"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate text-[11px]">
                            {level1Approver
                              ? level1Approver.approver_name
                              : "Level 1: Supervisor (Unassigned)"}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {level1Approver ? level1Approver.approver_position : "Sec. 7.B Recommendation"}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] shrink-0 font-medium">
                        L1
                      </Badge>
                    </div>

                    {/* Level 2: HRMO */}
                    <div
                      className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                        level2Approver
                          ? "bg-purple-500/5 border-purple-500/20"
                          : "border-dashed bg-muted/10 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ShieldCheck
                          className={`h-4 w-4 shrink-0 ${
                            level2Approver ? "text-purple-500" : "text-muted-foreground"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate text-[11px]">
                            {level2Approver
                              ? level2Approver.approver_name
                              : "Level 2: HRMO (Unassigned)"}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {level2Approver ? level2Approver.approver_position : "Sec. 7.A Certification"}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] shrink-0 font-medium">
                        L2
                      </Badge>
                    </div>

                    {/* Level 3: Mayor */}
                    <div
                      className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                        level3Approver
                          ? "bg-emerald-500/5 border-emerald-500/20"
                          : "border-dashed bg-muted/10 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Crown
                          className={`h-4 w-4 shrink-0 ${
                            level3Approver ? "text-emerald-500" : "text-muted-foreground"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate text-[11px]">
                            {level3Approver
                              ? level3Approver.approver_name
                              : "Level 3: Mayor (Unassigned)"}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {level3Approver ? level3Approver.approver_position : "Sec. 7.C Executive Action"}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] shrink-0 font-medium">
                        L3
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Bottom Card Action */}
                <div className="p-3 bg-muted/20 border-t">
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs font-semibold gap-1.5"
                    variant={status === "complete" ? "outline" : "default"}
                    onClick={() => onSetupDepartment(item)}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    {status === "complete" ? "Edit Hierarchy" : "Setup Department Hierarchy"}
                  </Button>
                </div>
              </Card>
            );
          })
        ) : (
          <div className="col-span-full border rounded-xl p-12 text-center bg-card">
            <Building2 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="font-semibold text-sm text-foreground">No Departments Match Filter</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Try clearing your search query or status filter.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
