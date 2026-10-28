"use client";

import React from "react";
import { CompanyPermitCard } from "./CompanyPermitCard";
import { PermitCatalogSlot, CompanyPermitRecord, PermitTypeItem } from "../types/permit.types";
import { FileQuestion } from "lucide-react";

interface PermitCatalogGridProps {
  slots: PermitCatalogSlot[];
  isLoading: boolean;
  onUpload: (type: PermitTypeItem) => void;
  onView: (permit: CompanyPermitRecord, history: CompanyPermitRecord[]) => void;
  onEdit: (permit: CompanyPermitRecord) => void;
  onRenew: (permit: CompanyPermitRecord) => void;
}

export const PermitCatalogGrid: React.FC<PermitCatalogGridProps> = ({
  slots,
  isLoading,
  onUpload,
  onView,
  onEdit,
  onRenew,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-2">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
          <div
            key={idx}
            className="h-72 rounded-2xl border border-border/60 bg-card p-0 flex flex-col overflow-hidden animate-pulse"
          >
            <div className="h-40 w-full bg-muted/60" />
            <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted/70 rounded" />
              </div>
              <div className="h-7 bg-muted/50 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="w-full border border-dashed rounded-2xl p-12 text-center bg-card/60 flex flex-col items-center justify-center space-y-2.5 my-4">
        <div className="p-3 rounded-2xl bg-muted/60 text-muted-foreground mb-1">
          <FileQuestion className="h-8 w-8 text-muted-foreground/60" />
        </div>
        <h3 className="text-base font-bold text-foreground">No Permits Found</h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          No permit requirements match your current search or filter criteria. Try adjusting your search query or reset the filter.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
        <h2 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
          <span>Current Monitored Permits</span>
          <span className="text-xs font-normal text-muted-foreground">({slots.length})</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {slots.map((slot) => (
          <CompanyPermitCard
            key={String(slot.permitType.id)}
            slot={slot}
            onUpload={onUpload}
            onView={onView}
            onEdit={onEdit}
            onRenew={onRenew}
          />
        ))}
      </div>
    </div>
  );
};
