"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  UserCheck,
  ShieldCheck,
  Crown,
  Plus,
  Building2,
  Trash2,
  Pencil,
  AlertCircle,
  Mail,
  Briefcase,
} from "lucide-react";
import {
  HierarchyPipelineStage,
  DepartmentInfo,
  LguLeaveApprover,
} from "../types";

interface HierarchyPipelineVisualizerProps {
  departments: DepartmentInfo[];
  selectedDepartmentId: string;
  onSelectDepartment: (deptId: string) => void;
  activeDepartment: DepartmentInfo | null;
  pipelineStages: HierarchyPipelineStage[];
  onAddApproverAtLevel: (level: number, departmentId: number) => void;
  onEditApprover: (approver: LguLeaveApprover) => void;
  onDeleteApprover: (approver: LguLeaveApprover) => void;
}

export function HierarchyPipelineVisualizer({
  departments,
  selectedDepartmentId,
  onSelectDepartment,
  activeDepartment,
  pipelineStages,
  onAddApproverAtLevel,
  onEditApprover,
  onDeleteApprover,
}: HierarchyPipelineVisualizerProps) {
  const getStageIcon = (level: number) => {
    switch (level) {
      case 1:
        return <UserCheck className="h-5 w-5 text-indigo-500" />;
      case 2:
        return <ShieldCheck className="h-5 w-5 text-purple-500" />;
      case 3:
        return <Crown className="h-5 w-5 text-emerald-500" />;
      default:
        return <UserCheck className="h-5 w-5 text-primary" />;
    }
  };

  return (
    <Card className="border shadow-sm overflow-hidden bg-gradient-to-b from-card to-card/60">
      <div className="p-4 sm:p-5 border-b flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-muted/20">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                CSC Form 6 Approval Sequence Flow
                <span className="text-xs font-normal text-muted-foreground">
                  (Official Statutory Routing)
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Sequential workflow order mandated for Local Government Unit leave certifications and executive authorizations.
              </p>
            </div>
          </div>
        </div>

        {/* Department Switcher */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap hidden sm:inline">
            Viewing Department:
          </span>
          <Select
            value={selectedDepartmentId}
            onValueChange={(val) => onSelectDepartment(val)}
          >
            <SelectTrigger className="w-full sm:w-[260px] h-9 text-xs font-medium">
              <SelectValue placeholder="Select Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs font-semibold">
                All Departments (Showing {departments[0]?.department_name || "Primary"})
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
        </div>
      </div>

      <CardContent className="p-4 sm:p-6">
        <div className="text-xs font-medium text-muted-foreground mb-4 flex items-center justify-between">
          <span>
            Active Hierarchy for:{" "}
            <span className="font-bold text-foreground">
              {activeDepartment?.department_name || "Select a Department"}
            </span>
          </span>
          <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
            3-Tier Statutory Pipeline
          </span>
        </div>

        {/* 3-Step Flow Pipeline */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 relative">
          {pipelineStages.map((stage, index) => {
            const hasApprovers = stage.approvers.length > 0;
            const isLast = index === pipelineStages.length - 1;

            return (
              <div key={stage.level} className="flex flex-col relative group">
                <div
                  className={`border rounded-xl p-4 flex flex-col justify-between h-full bg-card shadow-xs transition-all duration-200 hover:border-primary/40 ${
                    hasApprovers ? "border-border" : "border-dashed border-amber-500/40 bg-amber-500/5"
                  }`}
                >
                  {/* Step Header */}
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-muted/60 rounded-lg">
                          {getStageIcon(stage.level)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs sm:text-sm text-foreground">
                              {stage.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-medium">
                            {stage.subtitle}
                          </p>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold ${
                          hasApprovers
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                        }`}
                      >
                        {hasApprovers
                          ? `${stage.approvers.length} Assigned`
                          : "Unassigned"}
                      </Badge>
                    </div>

                    <div className="py-2.5 px-3 my-3 bg-muted/40 rounded-lg border text-[11px] text-muted-foreground">
                      <div className="font-semibold text-foreground/80 flex items-center justify-between mb-0.5">
                        <span>Legal Authority</span>
                        <span className="font-mono text-[10px] bg-background px-1.5 py-0.2 rounded border">
                          {stage.section}
                        </span>
                      </div>
                      <p className="leading-relaxed">{stage.roleName}</p>
                    </div>

                    {/* Approvers List for this stage */}
                    <div className="space-y-2 mt-2">
                      {hasApprovers ? (
                        stage.approvers.map((approver) => (
                          <div
                            key={approver.id}
                            className="p-3 rounded-lg border bg-background/80 hover:bg-background transition-colors flex items-start justify-between gap-2 shadow-2xs"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-foreground truncate">
                                {approver.approver_name}
                              </p>
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                                <Briefcase className="h-3 w-3 shrink-0" />
                                {approver.approver_position}
                              </p>
                              {approver.approver_email && (
                                <p className="text-[10px] text-muted-foreground/80 flex items-center gap-1 mt-0.5 truncate">
                                  <Mail className="h-2.5 w-2.5 shrink-0" />
                                  {approver.approver_email}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => onEditApprover(approver)}
                                title="Edit Approver"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                                onClick={() => onDeleteApprover(approver)}
                                title="Remove Approver"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 rounded-lg border border-dashed text-center space-y-1.5 bg-muted/20">
                          <AlertCircle className="h-5 w-5 text-amber-500 mx-auto" />
                          <p className="text-xs font-semibold text-foreground">
                            No Approver Configured
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Leaves for this department will stall at this stage.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add Approver Button on this Level */}
                  <div className="pt-3 mt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs font-medium h-8 border-dashed hover:border-primary hover:text-primary hover:bg-primary/5 gap-1.5"
                      onClick={() =>
                        activeDepartment &&
                        onAddApproverAtLevel(stage.level, activeDepartment.department_id)
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Assign Approver for Level {stage.level}
                    </Button>
                  </div>
                </div>

                {/* Arrow connector on desktop */}
                {!isLast && (
                  <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 bg-background border rounded-full p-1 text-muted-foreground shadow-xs">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
