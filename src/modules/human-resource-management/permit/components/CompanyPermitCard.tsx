"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState } from "react";
import {
  Calendar,
  AlertTriangle,
  AlertOctagon,
  Eye,
  Pencil,
  RefreshCw,
  Plus,
  Landmark,
  Shield,
  Flame,
  FileText,
  Building,
  FileCheck,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PermitCatalogSlot, CompanyPermitRecord, PermitTypeItem } from "../types/permit.types";

interface CompanyPermitCardProps {
  slot: PermitCatalogSlot;
  onUpload: (type: PermitTypeItem) => void;
  onView: (permit: CompanyPermitRecord, history: CompanyPermitRecord[]) => void;
  onEdit: (permit: CompanyPermitRecord) => void;
  onRenew: (permit: CompanyPermitRecord) => void;
}

const getPermitTypeIcon = (typeName: string) => {
  const lower = typeName.toLowerCase();
  if (lower.includes("barangay")) return Shield;
  if (lower.includes("mayor") || lower.includes("business")) return Landmark;
  if (lower.includes("fire") || lower.includes("fsic")) return Flame;
  if (lower.includes("bir") || lower.includes("cor") || lower.includes("tax")) return FileText;
  if (lower.includes("dti") || lower.includes("sec")) return Building;
  return FileCheck;
};

const formatDate = (dateString?: string | null) => {
  if (!dateString) return "N/A";
  try {
    const clean = dateString.substring(0, 10);
    const parts = clean.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
};

const getAbsoluteFileUrl = (url?: string | null) => {
  if (!url) return "";
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("blob:") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  if (url.startsWith("/assets/")) {
    return `${cleanBase}${url}`;
  }
  // If pure UUID / file id (e.g. 213734fc-6281-4ce7-bc2e-16f6b716b623)
  return `${cleanBase}/assets/${url}`;
};

export const CompanyPermitCard: React.FC<CompanyPermitCardProps> = ({
  slot,
  onUpload,
  onView,
  onEdit,
  onRenew,
}) => {
  const { permitType, currentPermit, history } = slot;
  const typeName = permitType.name || permitType.permit_type_name || "Permit Requirement";
  const [loadError, setLoadError] = useState(false);

  // Unregistered Slot Card (Image 2 style with upload placeholder, NO "Status: Pending")
  if (!currentPermit) {
    return (
      <Card className="group relative rounded-2xl border border-dashed border-border/90 hover:border-primary/50 bg-card hover:bg-card/90 transition-all duration-200 overflow-hidden flex flex-col justify-between h-full shadow-2xs">
        {/* Top Image Preview Canvas */}
        <div className="relative h-40 w-full bg-muted/30 dark:bg-muted/15 overflow-hidden flex flex-col items-center justify-center border-b border-border/60 p-4 text-center">
          <div className="p-3 rounded-2xl bg-muted/60 text-muted-foreground/80 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
            {React.createElement(getPermitTypeIcon(typeName), { className: "h-7 w-7" })}
          </div>
          <span className="text-[11px] font-medium text-muted-foreground mt-2">
            No certificate uploaded
          </span>
          <Badge
            variant="outline"
            className="absolute top-3 right-3 text-[10px] bg-background/80 backdrop-blur-xs text-muted-foreground border-border shrink-0"
          >
            Not Filed
          </Badge>
        </div>

        {/* Content Body */}
        <CardContent className="p-4 flex flex-col justify-between flex-1 space-y-3">
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-foreground truncate" title={typeName}>
              {typeName}
            </h3>
            <p className="text-xs text-muted-foreground">
              Statutory Compliance Requirement
            </p>
          </div>

          {/* Bottom Row: Clean Upload Certificate button (No Status: Pending) */}
          <div className="pt-2 border-t border-border/60 flex items-center justify-end">
            <Button
              type="button"
              size="sm"
              onClick={() => onUpload(permitType)}
              className="h-8 px-4 text-xs gap-1.5 font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs transition-all cursor-pointer w-full"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Upload Certificate</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Active / Registered Permit Card (Strictly Matching Image 2 style)
  const isExpired = currentPermit.health_level === "critical";
  const isExpiring = currentPermit.health_level === "warning";
  const days = currentPermit.days_remaining ?? 0;
  // Renew is only enabled / visible if permit is expired or expiring soon (within 90 days), exactly as in Permit Creation
  const canRenew = isExpired || isExpiring || (currentPermit.days_remaining !== undefined && currentPermit.days_remaining <= 90);

  const rawUrl = currentPermit.file_url || "";
  const fileUrl = getAbsoluteFileUrl(rawUrl);
  const isPdf = /\.pdf$/i.test(rawUrl);
  const isImage = Boolean(fileUrl && !isPdf && !loadError);

  const cardBorderClass = isExpired
    ? "border-destructive/40 bg-destructive/[0.01]"
    : isExpiring
    ? "border-amber-500/40 bg-amber-500/[0.01]"
    : "border-border/80 bg-card hover:border-primary/50";

  return (
    <Card
      className={`group relative rounded-2xl border shadow-2xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between h-full ${cardBorderClass}`}
    >
      {/* Top Image Preview Canvas (Image 2 style) */}
      <div
        onClick={() => onView(currentPermit, history)}
        className="relative h-44 w-full bg-slate-950/5 dark:bg-slate-900/60 overflow-hidden flex items-center justify-center border-b border-border/60 cursor-pointer select-none"
      >
        {fileUrl && isImage ? (
          <img
            src={fileUrl}
            alt={currentPermit.permit_number}
            onError={() => setLoadError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : fileUrl && isPdf ? (
          <div className="w-full h-full relative overflow-hidden bg-white dark:bg-slate-900 flex flex-col items-center justify-center p-3">
            <FileText className="h-10 w-10 text-primary/70 mb-1" />
            <span className="text-[11px] font-semibold text-foreground/80">PDF Document</span>
            <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">{currentPermit.permit_number}</span>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 text-muted-foreground">
            {React.createElement(getPermitTypeIcon(typeName), { className: "h-10 w-10 text-muted-foreground/60 mb-1" })}
            <span className="text-[11px] font-medium text-muted-foreground/80">Certificate Attached</span>
          </div>
        )}

        {/* Floating Top-Right Status Badge (Image 2 exact style) */}
        <div className="absolute top-3 right-3 z-10">
          {isExpired ? (
            <Badge variant="destructive" className="text-[10px] px-2 py-0.5 font-semibold gap-1 rounded-full shadow-xs">
              <AlertOctagon className="h-3 w-3" />
              Expired
            </Badge>
          ) : isExpiring ? (
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0.5 font-semibold gap-1 rounded-full bg-amber-500 text-white border-amber-600 shadow-xs"
            >
              <AlertTriangle className="h-3 w-3" />
              Expiring ({days}d)
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[10px] px-2.5 py-0.5 font-semibold gap-1 rounded-full bg-emerald-600 text-white border-emerald-700 shadow-xs"
            >
              <ShieldCheck className="h-3 w-3" />
              Active
            </Badge>
          )}
        </div>
      </div>

      {/* Middle Body: Title and Permit Number */}
      <CardContent className="p-4 flex flex-col justify-between flex-1 space-y-3">
        <div
          onClick={() => onView(currentPermit, history)}
          className="space-y-1 cursor-pointer select-none"
        >
          <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors truncate" title={typeName}>
            {typeName}
          </h3>
          <p className="text-xs font-mono font-medium text-muted-foreground truncate" title={currentPermit.permit_number}>
            No: {currentPermit.permit_number}
          </p>
        </div>

        {/* Bottom Expiry & Status Row (Image 2 style) */}
        <div className="pt-2.5 border-t border-border/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
            <span className="text-[11px]">
              Exp: {formatDate(currentPermit.expiry_date || currentPermit.expiration_date)}
            </span>
          </div>

          <div className="text-[11px] font-semibold">
            {isExpired ? (
              <span className="text-destructive">Expired</span>
            ) : isExpiring ? (
              <span className="text-amber-600 dark:text-amber-400">Needs Renewal</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400">Valid</span>
            )}
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onView(currentPermit, history)}
            className="h-7.5 px-2.5 text-xs gap-1 font-medium rounded-lg hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
          >
            <Eye className="h-3 w-3" />
            <span>View</span>
          </Button>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEdit(currentPermit)}
              className="h-7.5 px-2 text-xs gap-1 font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <Pencil className="h-3 w-3" />
              <span>Edit</span>
            </Button>

            {/* Renew Button: Only visible if expired or expiring soon (within 90 days) */}
            {canRenew && (
              <Button
                type="button"
                size="sm"
                onClick={() => onRenew(currentPermit)}
                className="h-7.5 px-2.5 text-xs gap-1 font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Renew</span>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
