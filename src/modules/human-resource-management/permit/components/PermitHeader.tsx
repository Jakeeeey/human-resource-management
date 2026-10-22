"use client";

import React from "react";
import {
  FileCheck2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Search,
  RefreshCw,
  Plus,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CompanyPermitSummary } from "../types/permit.types";
import { ComplianceHealthCard } from "./ComplianceHealthCard";

interface PermitHeaderProps {
  summary: CompanyPermitSummary;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenUploadNew: () => void;
}

export const PermitHeader: React.FC<PermitHeaderProps> = ({
  summary,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  isLoading,
  onRefresh,
  onOpenUploadNew,
}) => {
  return (
    <div className="space-y-4">
      {/* Top Banner & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Company Permit Management
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage, renew, and track official statutory and regulatory permit compliance
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-8.5 px-3 text-xs gap-1.5 rounded-lg border-border/80 hover:bg-muted/60 transition-all cursor-pointer shadow-2xs"
            title="Refresh permits"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-primary" : "text-muted-foreground"}`} />
            <span>Refresh</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onOpenUploadNew}
            className="h-8.5 px-3.5 text-xs gap-1.5 font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Upload Permit</span>
          </Button>
        </div>
      </div>

      {/* Top Stats Section: Compliance Health Donut Card + KPI Cards (Equalized Heights) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-stretch">
        {/* Left Column: Image 4 Compliance Health Circular Donut Card */}
        <div className="md:col-span-2 h-full flex flex-col">
          <ComplianceHealthCard
            summary={summary}
            isSelected={statusFilter === "all"}
            onClick={() => onStatusFilterChange("all")}
          />
        </div>

        {/* Right Columns: 4 KPI Stat Cards */}
        <div className="md:col-span-3 grid grid-cols-2 gap-3 h-full">
          {/* Active & Valid */}
          <Card
            onClick={() => onStatusFilterChange("active")}
            className={`border rounded-2xl shadow-2xs transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between ${
              statusFilter === "active"
                ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/[0.04]"
                : "border-border/80 bg-card hover:border-emerald-500/40 hover:shadow-xs"
            }`}
          >
            <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Active & Valid
                </span>
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                  <FileCheck2 className="h-3.5 w-3.5" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                    {summary.compliantCount}
                  </span>
                  <span className="text-[11px] text-muted-foreground">permits</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Valid {">"} 90 days validity
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Expiring Soon */}
          <Card
            onClick={() => onStatusFilterChange("expiring")}
            className={`border rounded-2xl shadow-2xs transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between ${
              statusFilter === "expiring"
                ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/[0.04]"
                : "border-border/80 bg-card hover:border-amber-500/40 hover:shadow-xs"
            }`}
          >
            <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Expiring Soon
                </span>
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400">
                    {summary.expiringCount}
                  </span>
                  <span className="text-[11px] text-muted-foreground">within 90 days</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Needs renewal filing
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Expired */}
          <Card
            onClick={() => onStatusFilterChange("expired")}
            className={`border rounded-2xl shadow-2xs transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between ${
              statusFilter === "expired"
                ? "border-destructive ring-2 ring-destructive/20 bg-destructive/[0.04]"
                : "border-border/80 bg-card hover:border-destructive/40 hover:shadow-xs"
            }`}
          >
            <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Expired
                </span>
                <div className="p-1.5 rounded-lg bg-destructive/10 text-destructive group-hover:scale-105 transition-transform">
                  <AlertOctagon className="h-3.5 w-3.5" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black tracking-tight text-destructive">
                    {summary.expiredCount}
                  </span>
                  <span className="text-[11px] text-muted-foreground">critical</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Immediate renewal required
                </p>
              </div>
            </CardContent>
          </Card>

          {/* No Record */}
          <Card
            onClick={() => onStatusFilterChange("no_record")}
            className={`border rounded-2xl shadow-2xs transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between ${
              statusFilter === "no_record"
                ? "border-slate-500 ring-2 ring-slate-500/20 bg-slate-500/[0.04]"
                : "border-border/80 bg-card hover:border-slate-500/40 hover:shadow-xs"
            }`}
          >
            <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  No Record
                </span>
                <div className="p-1.5 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400 group-hover:scale-105 transition-transform">
                  <Clock className="h-3.5 w-3.5" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black tracking-tight text-foreground">
                    {summary.missingCount}
                  </span>
                  <span className="text-[11px] text-muted-foreground">unregistered</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Awaiting initial registration
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by permit name, permit number, or issuing agency..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl bg-card border-border/80 focus-visible:ring-primary/20"
          />
        </div>

        {/* Status Filter Pill Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "All Permits" },
            { id: "active", label: "Active" },
            { id: "expiring", label: "Expiring (≤ 90d)" },
            { id: "expired", label: "Expired" },
            { id: "no_record", label: "No Record" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onStatusFilterChange(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer shrink-0 ${
                statusFilter === tab.id
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
