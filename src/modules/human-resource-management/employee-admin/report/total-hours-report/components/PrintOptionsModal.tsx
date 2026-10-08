"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileDown, Download, Loader2, Printer, X } from "lucide-react";
import { toast } from "sonner";
import type { DepartmentMatrixData, TotalHoursReportFilters } from "../type";
import {
  formatReportDate,
  downloadTotalHoursPdf,
  openSummaryReportPrintWindow,
} from "./printSummaryReport";

interface PrintOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  matrix: DepartmentMatrixData | null;
  filters: TotalHoursReportFilters;
  departments: Array<{ department_id: number; department_name: string }>;
}

export function PrintOptionsModal({
  isOpen,
  onClose,
  matrix,
  filters,
  departments,
}: PrintOptionsModalProps) {
  const [hoursOnly, setHoursOnly] = useState(false);
  const [includeTotals, setIncludeTotals] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!matrix) return null;

  const selectedDept = filters.departmentId
    ? departments.find((d) => d.department_id === filters.departmentId)
    : null;
  const departmentLabel = selectedDept ? selectedDept.department_name : "All";

  const rangeLabel = `${formatReportDate(filters.dateFrom)} — ${formatReportDate(filters.dateTo)}`;

  const handleDownloadPdf = async () => {
    try {
      setIsDownloading(true);
      await downloadTotalHoursPdf({
        matrix,
        filters,
        departments,
        hoursOnly,
        includeTotals,
      });
      toast.success("Total Hours Report PDF downloaded successfully");
      onClose();
    } catch (err) {
      console.error("PDF download error:", err);
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrintPreview = () => {
    openSummaryReportPrintWindow({
      matrix,
      filters,
      departments,
      hoursOnly,
      includeTotals,
    });
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[480px]" showCloseButton={false}>
        {/* Explicit guaranteed Close Button */}
        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 z-20 cursor-pointer transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>

        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <FileDown className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Export Total Hours Report
              </DialogTitle>
              <DialogDescription className="text-xs">
                Download your executive summary report as a clean PDF directly to your device.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Metadata preview card */}
          <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Date Range:</span>
              <span className="font-semibold text-foreground">{rangeLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Department:</span>
              <span className="font-semibold text-foreground">{departmentLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Active Employees:</span>
              <span className="font-semibold text-foreground">
                {matrix.employees.length} employees
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Orientation:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                Landscape (Auto)
              </span>
            </div>
          </div>

          {/* Metric Columns Mode */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Metrics to Include</Label>
            <RadioGroup
              value={hoursOnly ? "hours_only" : "full"}
              onValueChange={(val) => setHoursOnly(val === "hours_only")}
              className="grid grid-cols-1 gap-2"
            >
              <div
                className={`flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  !hoursOnly
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
                onClick={() => setHoursOnly(false)}
              >
                <RadioGroupItem value="full" id="r-full" className="mt-0.5" />
                <div className="space-y-0.5 leading-tight">
                  <Label htmlFor="r-full" className="text-xs font-bold cursor-pointer">
                    Full Metrics Breakdown (Per Day: T, L, O, U)
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Includes Total Work (T), Late (L), Overtime (O), and Undertime (U) for each day.
                  </p>
                </div>
              </div>

              <div
                className={`flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  hoursOnly
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
                onClick={() => setHoursOnly(true)}
              >
                <RadioGroupItem value="hours_only" id="r-hours-only" className="mt-0.5" />
                <div className="space-y-0.5 leading-tight">
                  <Label htmlFor="r-hours-only" className="text-xs font-bold cursor-pointer">
                    Hours Only (Per Day: T)
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Shows only approved working hours (T) per day. Ideal for wide 15-day or 30-day cutoffs.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Option: Include Period Totals Column */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="include-totals" className="text-xs font-semibold cursor-pointer">
                Include Period Summary Columns
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Appends the total work, late, OT, and UT summary columns at the end of the report.
              </p>
            </div>
            <Switch
              id="include-totals"
              checked={includeTotals}
              onCheckedChange={setIncludeTotals}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 sm:justify-between items-center w-full">
          <div className="flex items-center gap-2">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isDownloading}
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrintPreview}
              disabled={isDownloading}
              className="text-xs gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Preview
            </Button>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="text-xs font-semibold gap-1.5 cursor-pointer"
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
