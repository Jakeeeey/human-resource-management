"use client";

import { RefreshCw, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LogisticsReportHeaderProps {
  isLoading: boolean;
  onRefresh: () => void;
}

export function LogisticsReportHeader({
  isLoading,
  onRefresh,
}: LogisticsReportHeaderProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Logistics Report
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Review dispatch plans and expand rows to view full staff attendance.
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onRefresh}
        disabled={isLoading}
      >
        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        Refresh
      </Button>
    </div>
  );
}
