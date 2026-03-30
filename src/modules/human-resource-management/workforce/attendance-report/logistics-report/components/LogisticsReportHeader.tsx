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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <ClipboardList className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Post Dispatch Plan Staff Attendance Report
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Review each dispatch plan, then expand a row to see the complete
          attendance list of assigned staff.
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
