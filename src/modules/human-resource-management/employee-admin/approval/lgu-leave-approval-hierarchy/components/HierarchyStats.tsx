"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Building2, UserCheck, ShieldCheck, Crown } from "lucide-react";
import { LguLeaveApprover, DepartmentInfo } from "../types";

interface HierarchyStatsProps {
  approvers: LguLeaveApprover[];
  departments: DepartmentInfo[];
}

export function HierarchyStats({ approvers, departments }: HierarchyStatsProps) {
  const stats = useMemo(() => {
    const total = approvers.length;
    const configuredDeptIds = new Set(approvers.map((a) => a.department_id));
    const level1Count = approvers.filter((a) => a.level === 1).length;
    const level2Count = approvers.filter((a) => a.level === 2).length;
    const level3Count = approvers.filter((a) => a.level === 3).length;

    return {
      total,
      departmentsConfigured: configuredDeptIds.size,
      totalDepartments: departments.length,
      level1Count,
      level2Count,
      level3Count,
    };
  }, [approvers, departments]);

  const cards = [
    {
      title: "Total Approvers",
      value: stats.total,
      subtitle: "Active level assignments",
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
    },
    {
      title: "Departments Covered",
      value: `${stats.departmentsConfigured} / ${stats.totalDepartments}`,
      subtitle: "With active hierarchy",
      icon: Building2,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/20",
    },
    {
      title: "Level 1: Recommenders",
      value: stats.level1Count,
      subtitle: "Supervisors (Sec. 7.B)",
      icon: UserCheck,
      color: "text-indigo-500",
      bgColor: "bg-indigo-500/10",
      borderColor: "border-indigo-500/20",
    },
    {
      title: "Level 2: HR Certifiers",
      value: stats.level2Count,
      subtitle: "Credit balances (Sec. 7.A)",
      icon: ShieldCheck,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/20",
    },
    {
      title: "Level 3: Head of Agency",
      value: stats.level3Count,
      subtitle: "Mayor final action (Sec. 7.C)",
      icon: Crown,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <Card
            key={i}
            className={`border shadow-xs hover:shadow-md transition-all duration-200 ${c.borderColor}`}
          >
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {c.title}
                </span>
                <div className={`p-1.5 rounded-lg ${c.bgColor} ${c.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                  {c.value}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 font-medium truncate">
                  {c.subtitle}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
