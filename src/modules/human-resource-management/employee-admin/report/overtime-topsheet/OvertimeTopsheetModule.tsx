"use client";

import React, { useState } from "react";
import { useOvertimeTopsheet } from "./hooks/useOvertimeTopsheet";
import { TopsheetFilters } from "./components/TopsheetFilters";
import { TopsheetSummaryTable } from "./components/TopsheetSummaryTable";
import { exportTopsheetPDF } from "./utils/exportTopsheetPDF";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export default function OvertimeTopsheetModule() {
  const {
    data,
    departments,
    isLoading,
    error,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    departmentId,
    setDepartmentId,
    refresh
  } = useOvertimeTopsheet();

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (type: "both" | "topsheet" | "reasons") => {
    try {
      setIsExporting(true);
      
      const startStr = dateFrom ? format(dateFrom, "MMM d, yyyy") : "";
      const endStr = dateTo ? format(dateTo, "MMM d, yyyy") : "";
      const dateRangeText = startStr && endStr ? `${startStr} to ${endStr}` : startStr || endStr || "All Dates";

      await exportTopsheetPDF(data, type, dateRangeText);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overtime Topsheet</h1>
          <p className="text-muted-foreground">
            View and export approved overtime summaries
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters Card */}
      <Card>
        <CardContent className="pt-6">
          <TopsheetFilters
            dateFrom={dateFrom}
            dateTo={dateTo}
            departmentId={departmentId}
            departments={departments}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onDepartmentChange={setDepartmentId}
            onExport={handleExport}
            isExporting={isExporting}
          />
        </CardContent>
      </Card>

      {/* Main Content */}
      {isLoading && data.length === 0 ? (
        <div className="flex justify-center p-8">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <TopsheetSummaryTable data={data} />
      )}
    </div>
  );
}
