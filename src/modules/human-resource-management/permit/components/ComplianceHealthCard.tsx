"use client";

import React from "react";
import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CompanyPermitSummary } from "../types/permit.types";

interface ComplianceHealthCardProps {
  summary: CompanyPermitSummary;
  isSelected?: boolean;
  onClick?: () => void;
}

export const ComplianceHealthCard: React.FC<ComplianceHealthCardProps> = ({
  summary,
  isSelected = false,
  onClick,
}) => {
  const complianceRate = Math.min(100, Math.max(0, summary.complianceRate || 0));
  const activeCount = summary.compliantCount || 0;
  const expiringCount = summary.expiringCount || 0;
  const expiredCount = summary.expiredCount || 0;
  const total = summary.totalRequirements || (activeCount + expiringCount + expiredCount + (summary.missingCount || 0)) || 1;

  const activePercent = Math.round((activeCount / total) * 100);
  const expiringPercent = Math.round((expiringCount / total) * 100);
  const expiredPercent = Math.round((expiredCount / total) * 100);

  // Status Badge Logic
  let statusBadge = {
    label: "Good",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    ringColor: "#10b981",
  };

  if (expiredCount > 0 || complianceRate < 50) {
    statusBadge = {
      label: "Critical",
      className: "bg-destructive/15 text-destructive border-destructive/30",
      ringColor: "#ef4444",
    };
  } else if (expiringCount > 0 || complianceRate < 80) {
    statusBadge = {
      label: "Attention",
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
      ringColor: "#f59e0b",
    };
  }

  const size = 114;
  const strokeWidth = 11;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (complianceRate / 100) * circumference;

  return (
    <Card
      onClick={onClick}
      className={`border rounded-2xl shadow-2xs transition-all duration-200 cursor-pointer overflow-hidden relative group h-full flex flex-col justify-between ${
        isSelected
          ? "border-primary ring-2 ring-primary/20 bg-card"
          : "border-border/80 bg-card hover:border-primary/40 hover:shadow-xs"
      }`}
    >
      <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Activity className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-xs sm:text-sm text-foreground truncate">
                Compliance Health
              </h3>
              <p className="text-[10px] text-muted-foreground truncate">
                Valid and active permits
              </p>
            </div>
          </div>

          <Badge
            variant="outline"
            className={`text-[9px] px-2 py-0.5 font-semibold shrink-0 rounded-full border ${statusBadge.className}`}
          >
            {statusBadge.label}
          </Badge>
        </div>

        {/* Circular Donut Gauge */}
        <div className="flex flex-col items-center justify-center py-0.5">
          <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg
              width={size}
              height={size}
              className="-rotate-90 transform"
            >
              {/* Background track circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="currentColor"
                strokeWidth={strokeWidth}
                fill="transparent"
                className="text-muted/40 dark:text-muted/20"
              />
              {/* Progress dynamic circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={statusBadge.ringColor}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700 ease-out"
              />
            </svg>

            {/* Inner Center Text */}
            <div className="absolute flex flex-col items-center justify-center text-center select-none">
              <span className="text-xl font-black text-foreground tracking-tight leading-none">
                {complianceRate}%
              </span>
              <span className="text-[8px] font-bold text-muted-foreground tracking-wider mt-1 uppercase">
                Compliance
              </span>
            </div>
          </div>
        </div>

        {/* Footer 3-col Breakdown */}
        <div className="pt-2 border-t border-border/60 grid grid-cols-3 gap-1 text-center">
          {/* Active */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Active</span>
            </div>
            <span className="text-[11px] font-bold text-foreground mt-0.5">
              {activeCount} <span className="text-[9px] font-normal text-muted-foreground">({activePercent}%)</span>
            </span>
          </div>

          {/* Expiring */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
              <span>Expiring</span>
            </div>
            <span className="text-[11px] font-bold text-foreground mt-0.5">
              {expiringCount} <span className="text-[9px] font-normal text-muted-foreground">({expiringPercent}%)</span>
            </span>
          </div>

          {/* Expired */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-[10px] font-medium text-destructive">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
              <span>Expired</span>
            </div>
            <span className="text-[11px] font-bold text-foreground mt-0.5">
              {expiredCount} <span className="text-[9px] font-normal text-muted-foreground">({expiredPercent}%)</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
