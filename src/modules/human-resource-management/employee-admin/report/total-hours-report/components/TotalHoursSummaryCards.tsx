"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, AlertTriangle, ArrowDownRight, Flame, Users } from "lucide-react";
import type { TotalHoursSummary } from "../type";

interface TotalHoursSummaryCardsProps {
  summary: TotalHoursSummary;
  isLoading: boolean;
}

function formatHoursAndMinutes(minutes: number): { primary: string; secondary: string } {
  if (!minutes || minutes <= 0) {
    return { primary: "0.0 hrs", secondary: "0 mins" };
  }
  const hours = (minutes / 60).toFixed(1);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const secondary = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return { primary: `${hours} hrs`, secondary };
}

export function TotalHoursSummaryCards({
  summary,
  isLoading,
}: TotalHoursSummaryCardsProps) {
  const workHours = formatHoursAndMinutes(summary.totalWorkMinutes);
  const lateHours = formatHoursAndMinutes(summary.totalLateMinutes);
  const undertimeHours = formatHoursAndMinutes(summary.totalUndertimeMinutes);
  const overtimeHours = formatHoursAndMinutes(summary.totalOvertimeMinutes);

  const cards = [
    {
      title: "Approved Work Hours",
      value: workHours.primary,
      subValue: workHours.secondary,
      icon: Clock,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-200 dark:border-emerald-800/40",
    },
    {
      title: "Approved Late",
      value: lateHours.primary,
      subValue: lateHours.secondary,
      icon: AlertTriangle,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      border: "border-amber-200 dark:border-amber-800/40",
    },
    {
      title: "Approved Undertime",
      value: undertimeHours.primary,
      subValue: undertimeHours.secondary,
      icon: ArrowDownRight,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/40",
      border: "border-rose-200 dark:border-rose-800/40",
    },
    {
      title: "Approved Overtime",
      value: overtimeHours.primary,
      subValue: overtimeHours.secondary,
      icon: Flame,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
      border: "border-indigo-200 dark:border-indigo-800/40",
    },
    {
      title: "Records / Employees",
      value: `${summary.totalDays} Days`,
      subValue: `${summary.uniqueEmployees} Active Employees`,
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      border: "border-blue-200 dark:border-blue-800/40",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <Card
            key={idx}
            className={`border shadow-xs transition-all hover:shadow-md ${card.border}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {card.title}
                </span>
                <div className={`rounded-md p-1.5 ${card.bg}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
              <div className="mt-2">
                {isLoading ? (
                  <div className="h-7 w-20 animate-pulse rounded bg-muted" />
                ) : (
                  <>
                    <div className="text-2xl font-bold tracking-tight">
                      {card.value}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {card.subValue}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
