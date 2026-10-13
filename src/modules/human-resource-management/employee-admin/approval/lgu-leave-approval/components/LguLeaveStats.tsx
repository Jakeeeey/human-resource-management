"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Clock, CheckCircle2, XCircle, ArrowUpRight } from "lucide-react";
import { LguLeaveRequest } from "../types";

interface LguLeaveStatsProps {
  requests: LguLeaveRequest[];
}

export function LguLeaveStats({ requests }: LguLeaveStatsProps) {
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const recommendedCount = requests.filter((r) => r.status === "recommended").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const disapprovedCount = requests.filter((r) => r.status === "disapproved").length;

  const stats = [
    {
      title: "Pending Review",
      value: pendingCount,
      description: "Awaiting initial/supervisor action",
      icon: Clock,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/20",
    },
    {
      title: "Recommended",
      value: recommendedCount,
      description: "Endorsed for Mayoral / Final action",
      icon: ArrowUpRight,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
    },
    {
      title: "Approved",
      value: approvedCount,
      description: "Officially approved with pay / without pay",
      icon: CheckCircle2,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
    },
    {
      title: "Disapproved",
      value: disapprovedCount,
      description: "Applications disapproved with justification",
      icon: XCircle,
      color: "text-rose-500",
      bgColor: "bg-rose-500/10",
      borderColor: "border-rose-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.title} className={`border ${item.borderColor} shadow-xs`}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{item.title}</p>
                <p className="text-2xl font-bold tracking-tight text-foreground">{item.value}</p>
                <p className="text-[11px] text-muted-foreground">{item.description}</p>
              </div>
              <div className={`p-2.5 rounded-lg ${item.bgColor} ${item.color}`}>
                <Icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
